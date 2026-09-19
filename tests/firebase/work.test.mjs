import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";
import { createWorkStore, workAge, STALE_AFTER_MS } from "../../assets/work-store.mjs";

let env;
const user = (uid) => ({ uid, email: `${uid}@example.test` });
const profile = (uid) => ({ name: uid, enabled: true, canForceUnlock: uid === "chief" });
const db = (uid) => env.authenticatedContext(uid, {
  email: user(uid).email, firebase: { sign_in_provider: "password" },
}).firestore();
const ref = (database) => sdk.doc(database, "adminWork", "global");
const store = (uid) => createWorkStore(db(uid), sdk);
const acquire = (uid) => store(uid).acquire(user(uid), profile(uid), "글 수정");
const valid = (uid) => ({ locked: true, lockId: crypto.randomUUID(), ...user(uid), worker: uid,
  task: "글 수정", startedAt: sdk.serverTimestamp(), updatedAt: sdk.serverTimestamp() });

before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-mathastro", firestore: {
    rules: await readFile(new URL("../../firebase/firestore.rules", import.meta.url), "utf8"),
  } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    for (const uid of ["alice", "bob", "chief"]) await sdk.setDoc(sdk.doc(context.firestore(), "adminUsers", uid), profile(uid));
  });
});
after(async () => env?.cleanup());

test("unauthenticated, anonymous and unregistered accounts cannot read or mutate the lock", async () => {
  const guest = env.unauthenticatedContext().firestore();
  const anon = env.authenticatedContext("alice", { firebase: { sign_in_provider: "anonymous" } }).firestore();
  for (const database of [guest, anon, db("outsider")]) {
    await assertFails(sdk.getDoc(ref(database)));
    await assertFails(sdk.setDoc(ref(database), valid("outsider")));
  }
  await acquire("alice");
  for (const database of [guest, anon, db("outsider")]) {
    await assertFails(sdk.getDoc(ref(database)));
    await assertFails(sdk.deleteDoc(ref(database)));
  }
});

test("owner acquires and releases; another administrator cannot start or normally end their work", async () => {
  const id = await acquire("alice");
  const data = (await sdk.getDoc(ref(db("bob")))).data();
  assert.equal(data.uid, "alice");
  assert.equal(data.lockId, id);
  assert.ok(data.startedAt instanceof sdk.Timestamp);
  await assert.rejects(acquire("bob"), { code: "work/locked" });
  await assert.rejects(store("bob").release(user("bob"), id), { code: "work/owner" });
  await assertFails(sdk.deleteDoc(ref(db("bob"))));
  await assertFails(store("bob").release(user("bob"), id, true));
  await store("alice").release(user("alice"), id);
  assert.equal((await sdk.getDoc(ref(db("bob")))).exists(), false);
});

test("simultaneous starts always have exactly one winner, including same-user tabs", async () => {
  for (const contenders of [["alice", "bob"], ["alice", "alice"], ["bob", "chief"]]) {
    const results = await Promise.allSettled(contenders.map(acquire));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const winner = (await sdk.getDoc(ref(db("chief")))).data();
    await store(winner.uid).release(user(winner.uid), winner.lockId);
  }
});

test("force unlock requires elevated role and an old confirmation cannot delete a new lock", async () => {
  const oldId = await acquire("alice");
  await store("chief").release(user("chief"), oldId, true);
  const newId = await acquire("alice");
  await assert.rejects(store("chief").release(user("chief"), oldId, true), { code: "work/changed" });
  await assert.rejects(store("alice").release(user("alice"), oldId), { code: "work/changed" });
  assert.equal((await sdk.getDoc(ref(db("chief")))).data().lockId, newId);
  await store("chief").release(user("chief"), newId, true);
});

test("clients cannot promote themselves, enumerate admins, or bypass revocation", async () => {
  await assertSucceeds(sdk.getDoc(sdk.doc(db("alice"), "adminUsers", "alice")));
  await assertFails(sdk.getDoc(sdk.doc(db("bob"), "adminUsers", "alice")));
  await assertFails(sdk.getDocs(sdk.collection(db("alice"), "adminUsers")));
  await assertFails(sdk.setDoc(sdk.doc(db("outsider"), "adminUsers", "outsider"), profile("outsider")));
  await assertFails(sdk.updateDoc(sdk.doc(db("alice"), "adminUsers", "alice"), { canForceUnlock: true }));
  await acquire("alice");
  await env.withSecurityRulesDisabled((context) => sdk.updateDoc(sdk.doc(context.firestore(), "adminUsers", "alice"), { enabled: false }));
  await assertFails(sdk.getDoc(ref(db("alice"))));
  await assertFails(sdk.deleteDoc(ref(db("alice"))));
});

test("rules reject forged identity, timestamps, fields, blank/oversize tasks and overwrites", async () => {
  for (const change of [
    { uid: "bob" }, { email: "bob@example.test" }, { worker: "bob" },
    { startedAt: sdk.Timestamp.fromMillis(0) }, { updatedAt: sdk.Timestamp.fromMillis(0) },
    { locked: false }, { extra: true }, { task: "" }, { task: "   " }, { task: "x".repeat(301) },
    { lockId: "wrong" },
  ]) await assertFails(sdk.setDoc(ref(db("alice")), { ...valid("alice"), ...change }));
  await acquire("alice");
  await assertFails(sdk.setDoc(ref(db("bob")), valid("bob")));
  await assertFails(sdk.updateDoc(ref(db("alice")), { task: "바꿈" }));
  await assertFails(sdk.setDoc(sdk.doc(db("alice"), "adminWork", "another"), valid("alice")));
  await assertFails(sdk.getDocs(sdk.collection(db("alice"), "adminWork")));
});

test("another administrator receives both acquire and release through the realtime listener", async () => {
  const values = [];
  let stop, timer;
  const updates = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Listener timed out")), 10000);
    stop = store("bob").watch((lock, confirmed) => {
      if (!confirmed) return;
      values.push(lock?.uid || null);
      if (values.includes("alice") && values.at(-1) === null) resolve();
    }, reject);
  });
  try {
    const id = await acquire("alice");
    await store("alice").release(user("alice"), id);
    await updates;
    assert.ok(values.includes("alice"));
    assert.equal(values.at(-1), null);
  } finally { clearTimeout(timer); stop?.(); }
});

test("3-hour stale warning has an exact boundary and never automatically releases", async () => {
  const startedAt = sdk.Timestamp.fromMillis(0);
  assert.equal(workAge({ startedAt }, STALE_AFTER_MS - 1).stale, false);
  assert.deepEqual(workAge({ startedAt }, STALE_AFTER_MS), { stale: true, label: "3시간 0분" });
  assert.equal(workAge({ startedAt }, -100).label, "0분");
  await env.withSecurityRulesDisabled((context) => sdk.setDoc(ref(context.firestore()), {
    ...valid("alice"), startedAt,
  }));
  await assert.rejects(acquire("bob"), { code: "work/locked" });
});
