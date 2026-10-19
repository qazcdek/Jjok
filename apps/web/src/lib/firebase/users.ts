import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { UserDoc } from "../schema";
import { db } from "./app";
import { SCHEMA_VERSION, type Writable } from "./types";

export const userRef = (uid: string) => doc(db, "users", uid);

/** 첫 로그인 시 users/{uid} 문서를 만든다 (DevDocs/03-data-model.md §3.1) */
export async function ensureUserDoc(user: User): Promise<void> {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const data: Writable<UserDoc> = {
    schemaVersion: SCHEMA_VERSION,
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    photoURL: user.photoURL,
    settings: { theme: "system", citationStyle: "apa", venueFilter: [] },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
}

export async function saveDriveFolders(
  uid: string,
  drive: NonNullable<UserDoc["drive"]>,
): Promise<void> {
  await updateDoc(userRef(uid), { drive, updatedAt: serverTimestamp() });
}

export async function loadDriveFolders(uid: string): Promise<UserDoc["drive"]> {
  const snap = await getDoc(userRef(uid));
  return (snap.data() as UserDoc | undefined)?.drive;
}
