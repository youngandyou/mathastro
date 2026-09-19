import { connectAdmin } from "./admin-auth.mjs";
import { createWorkStore, workAge } from "./work-store.mjs";

const $ = (id) => document.getElementById(id);
let client, store, user, profile, lock;
let ready = false, busy = false, generation = 0;
let stopAuth, stopProfile, stopWork;
const message = (text) => { $("admin-message").textContent = text; };

function render() {
  const authorized = Boolean(user && profile);
  const online = navigator.onLine && ready;
  const own = authorized && lock?.uid === user.uid;
  $("admin-login").hidden = Boolean(user);
  $("admin-session").hidden = !user;
  $("admin-identity").textContent = user ? `로그인: ${profile?.name || user.email}` : "";
  $("work-panel").hidden = !authorized;
  $("login-button").disabled = !client || busy;
  $("logout-button").disabled = busy;
  $("work-panel").dataset.state = !online ? "unknown" : lock ? "locked" : "free";
  $("work-heading").textContent = !online ? "작업 상태 확인 중…" : lock ? "🔴 현재 작업 중" : "🟢 작업 가능";
  $("work-connection").textContent = online ? "" : "서버의 최신 상태를 확인할 수 없습니다. 연결을 확인하고 Git 작업을 시작하지 마세요.";
  $("work-start").hidden = !online || Boolean(lock);
  $("work-details").hidden = !lock;
  $("work-end").hidden = !own;
  $("work-force").hidden = !lock || own || profile?.canForceUnlock !== true;
  $("work-other").hidden = own;
  $("work-git").hidden = !own || !online || busy;
  for (const id of ["start-button", "work-end", "work-force"]) $(id).disabled = busy || !online || !authorized;
  if (lock) {
    $("work-worker").textContent = lock.worker;
    $("work-task").textContent = lock.task;
    const started = lock.startedAt?.toDate();
    $("work-started").textContent = started ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(started) : "저장 중…";
    const age = started ? workAge(lock) : null;
    $("work-elapsed").textContent = age?.label || "저장 중…";
    $("work-stale").hidden = !age?.stale;
  }
}

function errorText(error) {
  if (error.code?.startsWith("work/")) return error.message;
  if (error.code === "permission-denied") return "운영진 권한이 없거나 변경되었습니다. 운영진 등록과 Firestore 규칙을 확인해주세요.";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(error.code)) return "이메일 또는 비밀번호를 확인해주세요.";
  if (error.code === "auth/operation-not-allowed") return "Firebase Console에서 이메일/비밀번호 로그인을 활성화해주세요.";
  if (error.code === "auth/too-many-requests") return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";
  return "연결 또는 요청에 실패했습니다. 인터넷 연결을 확인하고 다시 연결해주세요.";
}

function disconnect(error) {
  ready = false;
  lock = null;
  stopWork?.(); stopWork = undefined;
  message(errorText(error));
  $("admin-retry").hidden = false;
  render();
}

async function connect() {
  const current = ++generation;
  stopAuth?.(); stopProfile?.(); stopWork?.();
  stopAuth = stopProfile = stopWork = undefined;
  user = profile = lock = null; ready = false; client = undefined;
  $("admin-retry").hidden = true;
  message("로그인 연결을 준비하고 있습니다…");
  render();
  try {
    const connected = await connectAdmin();
    if (current !== generation) return;
    client = connected;
    store = createWorkStore(client.db, client.sdk);
    stopAuth = client.observe((nextUser) => {
      stopProfile?.(); stopWork?.(); stopWork = undefined;
      user = nextUser; profile = lock = null; ready = false;
      message(user ? "운영진 권한을 확인하고 있습니다…" : "");
      render();
      if (!user) return;
      const observedUser = user;
      stopProfile = client.watchProfile(user, (nextProfile) => {
        if (current !== generation || user !== observedUser) return;
        profile = nextProfile;
        if (!profile) {
          stopWork?.(); stopWork = undefined;
          lock = null; ready = false;
          message("운영진 권한을 확인할 수 없습니다. 서버 연결과 adminUsers 등록 상태를 확인해주세요.");
        } else if (!stopWork) {
          message("");
          stopWork = store.watch((nextLock, confirmed) => {
            if (current !== generation || user !== observedUser) return;
            if (confirmed && lock?.uid === user.uid && nextLock?.lockId !== lock.lockId) {
              message("본인의 작업 잠금이 해제되거나 변경되었습니다. Git 작업을 중단하고 현재 상태를 확인해주세요.");
            }
            lock = nextLock; ready = confirmed;
            render();
          }, (error) => { if (current === generation && user === observedUser) disconnect(error); });
        }
        render();
      }, (error) => {
        if (current !== generation || user !== observedUser) return;
        profile = null;
        disconnect(error);
      });
    }, disconnect);
    render();
  } catch (error) { if (current === generation) disconnect(error); }
}

async function perform(action) {
  if (busy) return;
  busy = true; message(""); render();
  try { await action(); }
  catch (error) { message(errorText(error)); }
  finally { busy = false; render(); }
}

$("login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!client) return;
  perform(async () => {
    const password = $("admin-password").value;
    $("admin-password").value = "";
    await client.login($("admin-email").value.trim(), password);
  });
});
$("logout-button").addEventListener("click", () => perform(async () => {
  await client.logout();
  message("로그아웃했습니다. 진행 중인 작업 잠금은 유지됩니다.");
}));
$("work-start").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!ready || !navigator.onLine || !profile || lock) return;
  perform(async () => {
    await store.acquire(user, profile, $("task-input").value);
    $("task-input").value = "";
    message("작업 잠금을 획득했습니다. 아래 Git 안내를 확인해주세요.");
  });
});
function release(force) {
  if (!lock || !ready || !navigator.onLine || !profile || busy) return;
  const expected = lock.lockId;
  if (force && !window.confirm(`현재 ${lock.worker}님의 작업 상태를 강제로 해제하시겠습니까?\n\n작업자가 실제로 Git 작업 중이라면 충돌이 발생할 수 있습니다. 먼저 작업자에게 확인해주세요.`)) return;
  perform(async () => {
    await store.release(user, expected, force);
    message(force ? "작업 상태를 강제로 해제했습니다." : "작업을 종료했습니다.");
  });
}
$("work-end").addEventListener("click", () => release(false));
$("work-force").addEventListener("click", () => release(true));
$("copy-git").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText("git switch main\ngit pull origin main"); message("Git 명령을 복사했습니다."); }
  catch { message("자동 복사에 실패했습니다. 화면의 명령을 직접 복사해주세요."); }
});
$("admin-retry").addEventListener("click", connect);
window.addEventListener("offline", () => { ready = false; render(); });
window.addEventListener("online", connect);
setInterval(render, 30000);
connect();
