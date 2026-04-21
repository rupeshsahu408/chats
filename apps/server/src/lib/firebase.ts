import { env } from "../env.js";

let _app: import("firebase-admin/app").App | null = null;
let _initialized = false;

export function isFirebaseConfigured(): boolean {
  return !!(
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  );
}

async function getFirebaseApp(): Promise<import("firebase-admin/app").App> {
  if (_app) return _app;
  if (_initialized) throw new Error("Firebase Admin not configured.");

  _initialized = true;

  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  const { initializeApp, cert } = await import("firebase-admin/app");
  _app = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID!,
      clientEmail: env.FIREBASE_CLIENT_EMAIL!,
      privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
  return _app;
}

/**
 * Verify a Firebase ID token and return the decoded claims.
 * Throws if the token is invalid or Firebase is not configured.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<{ uid: string; phone_number?: string }> {
  const app = await getFirebaseApp();
  const { getAuth } = await import("firebase-admin/auth");
  const decoded = await getAuth(app).verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    phone_number: decoded.phone_number,
  };
}
