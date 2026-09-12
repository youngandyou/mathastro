export function postPath(pageUrl, siteUrl) {
  const page = new URL(pageUrl);
  const site = new URL(siteUrl);
  if (page.origin !== site.origin || !page.pathname.startsWith(site.pathname)) {
    return null;
  }
  const relative = decodeURIComponent(page.pathname.slice(site.pathname.length))
    .normalize("NFC")
    .replace(/index\.html$/, "")
    .replace(/\/+$/, "");
  return relative.startsWith("posts/") ? relative + "/" : null;
}

export async function postId(path) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createLikeStore(db, sdk, post) {
  const counter = sdk.doc(db, "postLikes", post.id);
  const vote = (uid) => sdk.doc(counter, "votes", uid);

  return {
    watchCount(next, error) {
      return sdk.onSnapshot(counter, { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache) next(snapshot.exists() ? snapshot.data().count : 0);
      }, error);
    },
    watchVote(uid, next, error) {
      return sdk.onSnapshot(vote(uid), { includeMetadataChanges: true }, (snapshot) => {
        if (!snapshot.metadata.fromCache) next(snapshot.exists() && snapshot.data().liked === true);
      }, error);
    },
    async setLiked(uid, desired) {
      return sdk.runTransaction(db, async (transaction) => {
        const own = await transaction.get(vote(uid));
        const liked = own.exists() && own.data().liked === true;
        if (liked === desired) return { liked };

        // Only the user's vote is read; atomic increments avoid counter contention.
        transaction.set(counter, { count: sdk.increment(desired ? 1 : -1), path: post.path }, { merge: true });
        transaction.set(vote(uid), { liked: desired });
        return { liked: desired };
      }).catch(async (error) => {
        // Another tab may have committed the same vote before rule evaluation.
        if (error.code === "permission-denied") {
          const current = await sdk.getDocFromServer(vote(uid));
          const committed = current.exists() && current.data().liked === true;
          if (committed === desired) return { liked: committed };
        }
        throw error;
      });
    },
  };
}
