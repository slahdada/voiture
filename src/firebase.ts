import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, setDoc, getDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("offline") ||
      msg.includes("unavailable") ||
      msg.includes("fetch failed") ||
      msg.includes("failed to get document") ||
      msg.includes("network")
    );
  }
  return false;
}

async function testConnection() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn("Firebase client in offline mode during connection check.");
    } else {
      console.warn("Firebase connection check warning:", error);
    }
  }
}
void testConnection();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  if (isOfflineError(error)) {
    console.warn("Firestore (Offline warning):", errMessage);
    return;
  }

  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function syncStateToFirestore(
  state: any,
  userId: string,
  email?: string,
  displayName?: string,
): Promise<boolean> {
  if (!userId) return false;
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, "users", userId);
    await setDoc(docRef, {
      userId,
      email: email || auth.currentUser?.email || "",
      displayName: displayName || auth.currentUser?.displayName || "",
      stateJson: JSON.stringify(state),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn("Sync skipped: client is offline");
      return false;
    }
    console.warn("Sync failed:", error);
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Return false instead of blocking
    }
    return false;
  }
}

export async function fetchStateFromFirestore(userId: string): Promise<any | null> {
  if (!userId) return null;
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, "users", userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.stateJson) {
        return JSON.parse(data.stateJson);
      }
    }
    return null;
  } catch (error) {
    if (isOfflineError(error)) {
      console.warn("Fetch skipped: client is offline");
      return null;
    }
    console.warn("Fetch failed:", error);
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Return null instead of blocking
    }
    return null;
  }
}

