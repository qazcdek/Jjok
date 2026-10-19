// PDF 업로드 → 메타데이터 결정(M1-03·M1-04) → Drive 저장 → Work/Version 문서 생성.
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { drive, type AppFolders } from "../../lib/drive";
import { db } from "../../lib/firebase/app";
import { SCHEMA_VERSION, type Writable } from "../../lib/firebase/types";
import { loadDriveFolders, saveDriveFolders } from "../../lib/firebase/users";
import { sha256Hex } from "../../lib/files/hash";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { resolveFromPdf, type Resolved } from "../metadata/resolve";
import { makeCiteKey, uniqueCiteKey } from "./citeKey";

export const worksCol = (uid: string) => collection(db, "users", uid, "works");
export const versionsCol = (uid: string, workId: string) =>
  collection(db, "users", uid, "works", workId, "versions");

/** 정규화 제목: 소문자, 기호 제거, 공백 정리 (매칭용, DevDocs/03-data-model.md §3.2) */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function appFolders(uid: string): Promise<AppFolders> {
  const cached = await loadDriveFolders(uid);
  const folders = await drive.ensureAppFolders(cached);
  if (
    folders.rootFolderId !== cached?.rootFolderId ||
    folders.filesFolderId !== cached?.filesFolderId
  ) {
    await saveDriveFolders(uid, folders);
  }
  return folders;
}

export interface UploadResult {
  workRef: DocumentReference;
  versionId: string;
  fileId: string;
  fileHash: string;
  resolved: Resolved;
}

/** 사용자 라이브러리 안에서 유일한 citeKey (M1-11) */
async function freeCiteKey(uid: string, base: string): Promise<string> {
  const snap = await getDocs(
    query(
      worksCol(uid),
      where("citeKey", ">=", base),
      where("citeKey", "<=", `${base}\uf8ff`),
      limit(30),
    ),
  );
  const taken = new Set(snap.docs.map((d) => (d.data() as WorkDoc).citeKey));
  return uniqueCiteKey(base, (k) => taken.has(k));
}

export async function uploadPdf(
  uid: string,
  file: File,
  resolve: (file: File) => Promise<Resolved> = resolveFromPdf,
): Promise<UploadResult> {
  const workRef = doc(worksCol(uid));
  const versionRef = doc(versionsCol(uid, workRef.id));
  const [fileHash, folders, resolved] = await Promise.all([
    sha256Hex(file),
    appFolders(uid),
    resolve(file),
  ]);
  const { work: meta, version: ver } = resolved;
  const citeKey = await freeCiteKey(uid, makeCiteKey(meta));
  const { fileId } = await drive.uploadPdf({
    folders,
    workId: workRef.id,
    versionId: versionRef.id,
    file,
  });

  const work: Writable<WorkDoc> = {
    schemaVersion: SCHEMA_VERSION,
    title: meta.title,
    normTitle: normalizeTitle(meta.title),
    authors: meta.authors,
    ...(meta.year !== undefined && { year: meta.year }),
    ...(meta.venue !== undefined && { venue: meta.venue }),
    ...(meta.abstract !== undefined && { abstract: meta.abstract }),
    primaryVersionId: versionRef.id,
    ids: meta.ids,
    citeKey,
    collectionIds: [],
    tagIds: [],
    ...(resolved.needsReview && { needsReview: true }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const version: Writable<VersionDoc> = {
    schemaVersion: SCHEMA_VERSION,
    kind: ver.kind,
    label: ver.label,
    ids: ver.ids,
    ...(ver.venue !== undefined && { venue: ver.venue }),
    ...(ver.year !== undefined && { year: ver.year }),
    ...(ver.pageCount !== undefined && { pageCount: ver.pageCount }),
    driveFileId: fileId,
    fileHash,
    fileName: file.name,
    fileSize: file.size,
    format: "pdf",
    metadataSource: resolved.metadataSource,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(workRef, work);
  batch.set(versionRef, version);
  await batch.commit();
  return { workRef, versionId: versionRef.id, fileId, fileHash, resolved };
}
