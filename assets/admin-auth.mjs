import { connectFirebase } from "./firebase-client.mjs";

export async function connectAdmin() {
  const client = await connectFirebase("mathastro-admin", "session");
  const { auth, authSdk, sdk, db } = client;
  return {
    ...client,
    observe: (next, error) => authSdk.onAuthStateChanged(auth, next, error),
    login: (email, password) => authSdk.signInWithEmailAndPassword(auth, email, password),
    logout: () => authSdk.signOut(auth),
    watchProfile(user, next, error) {
      return sdk.onSnapshot(sdk.doc(db, "adminUsers", user.uid), { includeMetadataChanges: true }, (snapshot) => {
        const profile = snapshot.exists() ? snapshot.data() : null;
        next(!snapshot.metadata.fromCache && !user.isAnonymous && profile?.enabled === true
          && typeof profile.name === "string" && profile.name.trim() ? profile : null);
      }, error);
    },
  };
}
