// Firestore 경로: users/{uid}/works/{workId}/versions/{versionId} (DevDocs/03-data-model.md §2)
import { collection, doc } from "firebase/firestore";
import { db } from "../../lib/firebase/app";

export const worksCol = (uid: string) => collection(db, "users", uid, "works");
export const versionsCol = (uid: string, workId: string) =>
  collection(db, "users", uid, "works", workId, "versions");
export const workRef = (uid: string, workId: string) => doc(worksCol(uid), workId);
