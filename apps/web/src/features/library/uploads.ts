// PDF 업로드 → Drive 저장 → Work/Version 문서 생성.
// M0 범위: 메타데이터 추출 없이 파일 이름을 제목으로 쓴다. 추출은 M1-03/M1-04.
import { doc, serverTimestamp, writeBatch, type DocumentReference } from "firebase/firestore";
import { drive, type AppFolders } from "../../lib/drive";
import { db } from "../../lib/firebase/app";
import { SCHEMA_VERSION, type Writable } from "../../lib/firebase/types";
import { loadDriveFolders, saveDriveFolders } from "../../lib/firebase/users";
import { sha256Hex } from "../../lib/files/hash";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { versionsCol, worksCol } from "../works/refs";
import { addVersion } from "../works/versions";

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
}

export interface UploadOptions {
  /** 지정하면 새 논문 대신 이 논문의 새 버전으로 추가한다 (기본 버전은 그대로) */
  workId?: string;
}

/** 업로드한 PDF 의 버전 문서. 메타데이터 추출 전이라 종류·식별자는 비어 있다 */
function uploadedVersion(file: File, fileId: string, fileHash: string): Writable<VersionDoc> {
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: "other",
    label: "업로드",
    ids: {},
    driveFileId: fileId,
    fileHash,
    fileName: file.name,
    fileSize: file.size,
    format: "pdf",
    metadataSource: "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function uploadPdf(
  uid: string,
  file: File,
  { workId }: UploadOptions = {},
): Promise<UploadResult> {
  const workRef = workId ? doc(worksCol(uid), workId) : doc(worksCol(uid));
  const versionRef = doc(versionsCol(uid, workRef.id));
  const [fileHash, folders] = await Promise.all([sha256Hex(file), appFolders(uid)]);
  const { fileId } = await drive.uploadPdf({
    folders,
    workId: workRef.id,
    versionId: versionRef.id,
    file,
  });
  const version = uploadedVersion(file, fileId, fileHash);

  if (workId) {
    await addVersion(uid, workId, versionRef, version);
    return { workRef, versionId: versionRef.id, fileId, fileHash };
  }

  const title = file.name.replace(/\.pdf$/i, "");
  const work: Writable<WorkDoc> = {
    schemaVersion: SCHEMA_VERSION,
    title,
    normTitle: normalizeTitle(title),
    authors: [],
    primaryVersionId: versionRef.id,
    ids: {},
    citeKey: `untitled-${workRef.id.slice(0, 6).toLowerCase()}`,
    collectionIds: [],
    tagIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // 논문과 기본 버전을 한 배치로 만든다 (보안 규칙이 기본 버전 존재를 검사)
  const batch = writeBatch(db);
  batch.set(workRef, work);
  batch.set(versionRef, version);
  await batch.commit();
  return { workRef, versionId: versionRef.id, fileId, fileHash };
}
