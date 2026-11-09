import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDocFromServer, setDoc, getDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
    console.error("Sync failed:", error);
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
    console.error("Fetch failed:", error);
    try {
      handleFirestoreError(error, OperationType.GET, path);
    } catch {
      // Return null instead of blocking
    }
    return null;
  }
}

