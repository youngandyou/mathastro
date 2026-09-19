import { connectFirebase } from "./firebase-client.mjs";
import { createLikeStore, postId, postPath } from "./likes-store.mjs";

const path = postPath(location.href, new URL("../", import.meta.url));
const main = document.querySelector("main#quarto-document-content");
if (path && main) mountLikes(main, path);

function mountLikes(main, path) {
  const panel = document.createElement("section");
  panel.className = "post-likes";
  panel.setAttribute("aria-label", "게시글 좋아요");
  panel.innerHTML = `
    <button type="button" class="post-like-button" aria-label="좋아요" aria-pressed="false" disabled>
      <i class="bi bi-heart" aria-hidden="true"></i>
      <span class="post-like-count">–</span>
    </button>
    <p class="post-like-status" role="status" aria-live="polite">불러오는 중…</p>
    <button type="button" class="post-like-retry" title="다시 연결" aria-label="다시 연결" hidden>
      <i class="bi bi-arrow-clockwise" aria-hidden="true"></i>
    </button>`;
  main.appendChild(panel);
  const button = panel.querySelector(".post-like-button");
  const countLabel = panel.querySelector(".post-like-count");
  const icon = button.querySelector("i");
  const status = panel.querySelector(".post-like-status");
  const retry = panel.querySelector(".post-like-retry");
  let store, auth, authSdk;
  let liked = false, countReady = false, voteReady = false, busy = false, failed = false;
  let starting = false, stopCount, stopVote, stopAuth, timer;

  function render() {
    button.disabled = busy || failed || !countReady || !voteReady;
    button.setAttribute("aria-pressed", String(liked));
    button.setAttribute("aria-busy", String(busy));
    button.setAttribute("aria-label", liked ? "좋아요 취소" : "좋아요");
    button.title = liked ? "좋아요 취소" : "좋아요";
    icon.className = liked ? "bi bi-heart-fill" : "bi bi-heart";
    if (!failed && countReady && voteReady) {
      clearTimeout(timer);
      status.textContent = busy ? "저장 중…" : "";
    }
  }

  function connectionError(error) {
    clearTimeout(timer);
    failed = true;
    status.textContent = "좋아요에 연결하지 못했습니다. 다시 시도해주세요.";
    retry.hidden = false;
    render();
    console.warn("MathAstro likes:", error.code || error.message);
  }

  async function connect() {
    if (starting) return;
    starting = true;
    stopCount?.(); stopVote?.(); stopAuth?.();
    clearTimeout(timer);
    failed = false; countReady = false; voteReady = false;
    retry.hidden = true;
    status.textContent = "불러오는 중…";
    render();
    try {
      const client = await connectFirebase("mathastro-likes");
      authSdk = client.authSdk;
      auth = client.auth;
      store = createLikeStore(client.db, client.sdk, { id: await postId(path), path });
      timer = setTimeout(() => connectionError(new Error("Connection timed out")), 15000);
      stopCount = store.watchCount((count) => {
        countLabel.textContent = count.toLocaleString("ko-KR");
        countReady = true;
        render();
      }, connectionError);
      stopAuth = authSdk.onAuthStateChanged(auth, (user) => {
        stopVote?.();
        liked = false;
        voteReady = !user;
        if (user) {
          stopVote = store.watchVote(user.uid, (value) => {
            liked = value;
            voteReady = true;
            render();
          }, connectionError);
        }
        render();
      }, connectionError);
    } catch (error) {
      if (error.code === "config/incomplete") status.textContent = "좋아요 기능을 준비 중입니다.";
      else connectionError(error);
    } finally {
      starting = false;
    }
  }

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const desired = !liked;
    busy = true;
    render();
    try {
      if (!navigator.onLine) throw new Error("Offline");
      const user = auth.currentUser || (await authSdk.signInAnonymously(auth)).user;
      const result = await store.setLiked(user.uid, desired);
      liked = result.liked;
      voteReady = true;
    } catch (error) {
      connectionError(error);
    } finally {
      busy = false;
      render();
    }
  });
  retry.addEventListener("click", connect);
  connect();
}
