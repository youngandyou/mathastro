// Share configuration and SDK loading while keeping visitor/admin auth independent.
let configuration;
export async function connectFirebase(name, persistence = "local") {
  if (!configuration) {
    configuration = fetch(new URL("./firebase-config.json", import.meta.url), {
      cache: "no-cache", signal: AbortSignal.timeout(10000),
    }).then(async (response) => {
      if (!response.ok) throw new Error("Firebase configuration unavailable");
      const config = await response.json();
      if (!["apiKey", "authDomain", "projectId", "appId"].every((key) => typeof config[key] === "string" && config[key].trim())) {
        throw Object.assign(new Error("Firebase configuration incomplete"), { code: "config/incomplete" });
      }
      return config;
    }).catch((error) => { configuration = undefined; throw error; });
  }
  const [config, appSdk, authSdk, sdk] = await Promise.all([
    configuration,
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"),
  ]);
  const app = appSdk.getApps().find((app) => app.name === name) || appSdk.initializeApp(config, name);
  const auth = authSdk.getAuth(app);
  await authSdk.setPersistence(auth, persistence === "session" ? authSdk.browserSessionPersistence : authSdk.browserLocalPersistence);
  return { auth, authSdk, sdk, db: sdk.getFirestore(app) };
}
