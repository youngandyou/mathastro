// Full UI against local Auth + Firestore emulators. Never contacts production Firebase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as sdk from "firebase/firestore";

const root = resolve(import.meta.dirname, "../../_site");
const projectId = "demo-mathastro";
const env = await initializeTestEnvironment({ projectId, firestore: {
  rules: await readFile(new URL("../../firebase/firestore.rules", import.meta.url), "utf8"),
} });
await env.clearFirestore();
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
const identities = {};
for (const name of ["alice", "bob", "chief", "outsider"]) {
  const response = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${name}@example.test`, password: "emulator-only-password", returnSecureToken: true }),
  });
  const result = await response.json();
  assert.ok(result.localId, JSON.stringify(result));
  identities[name] = result.localId;
  if (name !== "outsider") await env.withSecurityRulesDisabled((context) => sdk.setDoc(
    sdk.doc(context.firestore(), "adminUsers", result.localId),
    { name, enabled: true, canForceUnlock: name === "chief" },
  ));
}
const mime = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/mathastro\//, "");
  const file = resolve(root, path.endsWith("/") ? path + "index.html" : path);
  if (!file.startsWith(root + "/")) { response.writeHead(403).end(); return; }
  try { response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" }); response.end(await readFile(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/mathastro/`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const problems = [];
const contexts = [];
async function pageFor(name, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  contexts.push(context);
  await context.route("**/assets/firebase-config.json", (route) => route.fulfill({ json: {
    projectId, apiKey: "demo-key", authDomain: "demo-mathastro.firebaseapp.com", appId: "demo-app",
  } }));
  await context.route("**/assets/firebase-client.mjs", async (route) => {
    const source = await readFile(new URL("../../assets/firebase-client.mjs", import.meta.url), "utf8");
    await route.fulfill({ contentType: "text/javascript", body: source.replace(
      "const auth = authSdk.getAuth(app);", `const auth = authSdk.getAuth(app);
      if (!app.__emulators) {
        authSdk.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        sdk.connectFirestoreEmulator(sdk.getFirestore(app), '127.0.0.1', 8080);
        app.__emulators = true;
      }`,
    ) });
  });
  await context.route(/https:\/\/(firestore|identitytoolkit|securetoken)\.googleapis\.com\//, (route) => {
    problems.push("Production Firebase request attempted: " + route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (entry) => { if (entry.type() === "error") console.error("Browser:", entry.text()); });
  await page.goto(base + "admin/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.getElementById("login-button").disabled);
  assert.equal(await page.locator("#work-panel").isVisible(), false);
  await page.locator("#admin-email").fill(`${name}@example.test`);
  await page.locator("#admin-password").fill("emulator-only-password");
  await page.locator("#login-button").click();
  console.log(`Signed in: ${name}`);
  return page;
}
const waitState = (page, state) => page.waitForFunction((state) => document.getElementById("work-panel").dataset.state === state, state);
const waitVisible = (page, id) => page.locator(`#${id}`).waitFor({ state: "visible" });
try {
  const outsider = await pageFor("outsider");
  await waitVisible(outsider, "admin-session");
  await outsider.waitForFunction(() => document.getElementById("admin-message").textContent.includes("권한을 확인할 수 없습니다"));
  assert.equal(await outsider.locator("#work-panel").isVisible(), false);
  const alice = await pageFor("alice");
  const bob = await pageFor("bob", true);
  const chief = await pageFor("chief");
  await Promise.all([alice, bob, chief].map((page) => waitState(page, "free")));
  await alice.locator("#task-input").fill("Radio Astronomy 글 수정");
  await alice.locator("#start-button").click();
  await Promise.all([alice, bob, chief].map((page) => waitState(page, "locked")));
  await waitVisible(alice, "work-git");
  assert.equal(await bob.locator("#work-worker").textContent(), "alice");
  assert.equal(await bob.locator("#work-end").isVisible(), false);
  assert.equal(await bob.locator("#work-force").isVisible(), false);
  assert.equal(await chief.locator("#work-force").isVisible(), true);
  assert.equal(await bob.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const screenshot = process.env.SCREENSHOT_PATH;
  if (screenshot) await bob.screenshot({ path: screenshot, fullPage: true });
  chief.once("dialog", (dialog) => dialog.dismiss());
  await chief.locator("#work-force").click();
  await waitState(chief, "locked");
  chief.once("dialog", (dialog) => dialog.accept());
  await chief.locator("#work-force").click();
  await Promise.all([alice, bob, chief].map((page) => waitState(page, "free")));
  await alice.locator("#task-input").fill("다음 글 수정");
  await alice.locator("#start-button").click();
  await waitVisible(alice, "work-end");
  await alice.locator("#work-end").click();
  await waitState(bob, "free");
  // Inject an old server record to check actual warning rendering and XSS-safe text.
  await env.withSecurityRulesDisabled((context) => sdk.setDoc(sdk.doc(context.firestore(), "adminWork", "global"), {
    locked: true, lockId: crypto.randomUUID(), uid: identities.alice, email: "alice@example.test", worker: "alice",
    task: '<img src=x onerror="alert(1)">', startedAt: sdk.Timestamp.fromMillis(Date.now() - 4 * 3600000), updatedAt: sdk.Timestamp.now(),
  }));
  await waitVisible(bob, "work-stale");
  assert.equal(await bob.locator("#work-task img").count(), 0);
  assert.match(await bob.locator("#work-task").textContent(), /<img/);
  // The shared Firebase initializer preserves the existing anonymous likes session.
  const likes = await alice.context().newPage();
  await likes.goto(base + "posts/Astronomy/Basic_Radioastronomy0/", { waitUntil: "domcontentloaded" });
  await likes.waitForFunction(() => document.querySelector(".post-like-button")?.disabled === false);
  await likes.locator(".post-like-button").click();
  await likes.waitForFunction(() => document.querySelector(".post-like-button").getAttribute("aria-pressed") === "true");
  const visitor = await likes.evaluate(async () => {
    const { connectFirebase } = await import("../../../assets/firebase-client.mjs");
    const { auth } = await connectFirebase("mathastro-likes");
    return { uid: auth.currentUser.uid, anonymous: auth.currentUser.isAnonymous };
  });
  assert.equal(visitor.anonymous, true);
  assert.notEqual(visitor.uid, identities.alice);
  await alice.reload({ waitUntil: "domcontentloaded" });
  await waitVisible(alice, "work-end");
  await alice.locator("#logout-button").click();
  await waitVisible(alice, "admin-login");
  assert.equal(await alice.locator("#work-panel").isVisible(), false);
  await waitState(bob, "locked");
  const sameVisitor = await likes.evaluate(async () => {
    const { connectFirebase } = await import("../../../assets/firebase-client.mjs");
    return (await connectFirebase("mathastro-likes")).auth.currentUser.uid;
  });
  assert.equal(sameVisitor, visitor.uid);
  await likes.locator(".post-like-button").click();
  await likes.waitForFunction(() => document.querySelector(".post-like-button").getAttribute("aria-pressed") === "false");
  const qna = await alice.context().newPage();
  await qna.goto(base + "qna/", { waitUntil: "domcontentloaded" });
  await qna.locator(".qna-ask-button").waitFor();
  assert.match(await qna.locator(".qna-ask-button").getAttribute("href"), /github.com\/youngandyou\/mathastro\/discussions/);
  await bob.context().setOffline(true);
  await bob.waitForFunction(() => document.getElementById("work-panel").dataset.state === "unknown");
  assert.equal(await bob.locator("#start-button").isVisible(), false);
  await bob.context().setOffline(false);
  await waitState(bob, "locked");
  // Revocation hides both management UI and protected data without a reload.
  await env.withSecurityRulesDisabled((context) => sdk.updateDoc(sdk.doc(context.firestore(), "adminUsers", identities.bob), { enabled: false }));
  await bob.locator("#work-panel").waitFor({ state: "hidden" });
  assert.deepEqual(problems, []);
  console.log("PASS browser: login gate, UID allowlist, acquire/release, realtime, owner-only end, force confirmation/cancel, stale warning, XSS-safe text, session reload/logout, offline, revocation, mobile layout, Pages subpath assets, existing likes and isolated auth, Q&A");
} finally {
  await browser.close();
  await env.cleanup();
  await new Promise((resolve) => server.close(resolve));
}
