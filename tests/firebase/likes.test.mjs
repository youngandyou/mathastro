import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import { createLikeStore, postId, postPath } from "../../assets/likes-store.mjs";

let env;
const path = "posts/Astronomy/Astro_Superluminal-motion/";
const id = await postId(path);
const post = { id, path };
const dbFor = (uid) => env.authenticatedContext(uid).firestore();
const storeFor = (uid) => createLikeStore(dbFor(uid), sdk, post);
const counter = (db) => sdk.doc(db, "postLikes", id);
const vote = (db, uid) => sdk.doc(counter(db), "votes", uid);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-mathastro",
    firestore: { rules: await readFile(new URL("../../firebase/firestore.rules", import.meta.url), "utf8") },
  });
});
beforeEach(async () => env.clearFirestore());
after(async () => env?.cleanup());

test("public and local URLs share an ID across index.html, query strings and Unicode encoding", async () => {
  const root = "https://youngandyou.github.io/mathastro/";
  assert.equal(postPath(root + path + "index.html?x=1#heading", root), path);
  assert.equal(postPath("http://localhost:8000/" + path, "http://localhost:8000/"), path);
  assert.equal(postPath(root + "posts/Computer/Reinforcement%20Learning/", root), "posts/Computer/Reinforcement Learning/");
  assert.equal(postPath(root + "qna/", root), null);
  assert.equal(postPath(root, root), null);
  assert.equal((await postId(path)).length, 64);
});

test("like, repeat, unlike and relike keep one vote per user", async () => {
  const store = storeFor("alice");
  for (const desired of [true, true, false, false, true]) {
    assert.deepEqual(await store.setLiked("alice", desired), { liked: desired });
    assert.equal((await sdk.getDoc(counter(dbFor("alice")))).data().count, desired ? 1 : 0);
  }
});

test("simultaneous visitors do not lose increments", async () => {
  await Promise.all(["alice", "bob", "carol", "dan"].map(uid => storeFor(uid).setLiked(uid, true)));
  const total = await sdk.getDoc(counter(dbFor("alice")));
  assert.equal(total.data().count, 4);
  await Promise.all(["alice", "bob"].map(uid => storeFor(uid).setLiked(uid, false)));
  assert.equal((await sdk.getDoc(counter(dbFor("carol")))).data().count, 2);
});

test("counts are public but votes and other collections are private", async () => {
  await storeFor("alice").setLiked("alice", true);
  const guest = env.unauthenticatedContext().firestore();
  await assertSucceeds(sdk.getDoc(counter(guest)));
  await assertFails(sdk.getDoc(vote(guest, "alice")));
  await assertFails(sdk.getDoc(vote(dbFor("bob"), "alice")));
  await assertFails(sdk.getDocs(sdk.collection(dbFor("alice"), "postLikes", id, "votes")));
  await assertFails(sdk.setDoc(counter(guest), { count: 2, path }));
  await assertFails(sdk.setDoc(sdk.doc(dbFor("alice"), "unrelated", "data"), { value: 1 }));
});

test("two tabs from the same user cannot double count a simultaneous request", async () => {
  for (const desired of [true, false]) {
    await Promise.all([storeFor("alice"), storeFor("alice")].map(store => store.setLiked("alice", desired)));
    assert.equal((await sdk.getDoc(counter(dbFor("alice")))).data().count, desired ? 1 : 0);
  }
});

test("forged totals, unpaired writes, other-user votes and deletions are rejected", async () => {
  const alice = dbFor("alice");
  await assertFails(sdk.setDoc(counter(alice), { count: 1, path }));
  await assertFails(sdk.setDoc(vote(alice, "alice"), { liked: true }));
  await storeFor("alice").setLiked("alice", true);
  await assertFails(sdk.updateDoc(counter(alice), { count: 999 }));
  await assertFails(sdk.updateDoc(vote(alice, "alice"), { liked: false }));
  await assertFails(sdk.deleteDoc(counter(alice)));
  await assertFails(sdk.deleteDoc(vote(alice, "alice")));
  const bob = dbFor("bob");
  const forged = sdk.writeBatch(bob);
  forged.set(counter(bob), { count: 1000, path });
  forged.set(vote(bob, "bob"), { liked: true });
  await assertFails(forged.commit());
  const impersonated = sdk.writeBatch(alice);
  impersonated.update(counter(alice), { count: 2 });
  impersonated.set(vote(alice, "bob"), { liked: true });
  await assertFails(impersonated.commit());
});

test("post identity and schema cannot change during a valid vote", async () => {
  await storeFor("alice").setLiked("alice", true);
  const bob = dbFor("bob");
  for (const data of [{ count: 2, path: "posts/other/" }, { count: 2, path, extra: true }]) {
    const batch = sdk.writeBatch(bob);
    batch.set(counter(bob), data);
    batch.set(vote(bob, "bob"), { liked: true });
    await assertFails(batch.commit());
  }
});

test("a visitor receives another visitor's updated count through the live listener", async () => {
  const values = [];
  let stop;
  const updates = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Listener did not update")), 10000);
    stop = storeFor("bob").watchCount((count) => {
      values.push(count);
      if (count === 1) { clearTimeout(timeout); resolve(); }
    }, reject);
  });
  try {
    await storeFor("alice").setLiked("alice", true);
    await updates;
    assert.equal(values.at(-1), 1);
  } finally { stop?.(); }
});
