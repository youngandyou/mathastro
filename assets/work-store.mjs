export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export function workAge(lock, now = Date.now()) {
  const elapsed = Math.max(0, now - lock.startedAt.toMillis());
  const minutes = Math.floor(elapsed / 60000);
  return { stale: elapsed >= STALE_AFTER_MS, label: minutes < 60 ? `${minutes}분` : `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` };
}

function fail(code, message) { return Object.assign(new Error(message), { code }); }

export function createWorkStore(db, sdk) {
  const ref = sdk.doc(db, "adminWork", "global");
  return {
    watch(next, error) {
      return sdk.onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
        // Cached or optimistic data must never grant permission to begin Git work.
        next(snapshot.exists() ? snapshot.data() : null,
          !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites);
      }, error);
    },
    async acquire(user, profile, task) {
      task = task.trim();
      if (!task || task.length > 300) throw fail("work/task", "작업 내용을 1~300자로 입력해주세요.");
      const lockId = crypto.randomUUID();
      return sdk.runTransaction(db, async (tx) => {
        const current = await tx.get(ref);
        if (current.exists()) throw fail("work/locked", `작업을 시작할 수 없습니다. 현재 ${current.data().worker}님이 작업 중입니다.`);
        tx.set(ref, {
          locked: true, lockId, uid: user.uid, email: user.email,
          worker: profile.name, task,
          startedAt: sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp(),
        });
        return lockId;
      });
    },
    async release(user, expectedLockId, force = false) {
      return sdk.runTransaction(db, async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists() || snapshot.data().lockId !== expectedLockId) {
          throw fail("work/changed", "작업 상태가 변경되었습니다. 현재 상태를 확인해주세요.");
        }
        if (!force && snapshot.data().uid !== user.uid) throw fail("work/owner", "본인의 작업만 종료할 수 있습니다.");
        // Force privileges are checked by Security Rules, never trusted from this flag.
        tx.delete(ref);
      });
    },
  };
}
