// PDF 업로드: 해시 → 중복 검사 → 단서 추출 → Drive 저장 → 논문·버전 문서 생성 (M1-02, M1-03).
// 메타데이터 조회(M1-04) 전이라 PDF 에서 찾은 제목 후보, 없으면 파일 이름을 임시 제목으로 쓴다.
import { doc, getDocs, limit, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { drive, type AppFolders } from "../../lib/drive";
import { db } from "../../lib/firebase/app";
import { SCHEMA_VERSION, type Writable } from "../../lib/firebase/types";
import { loadDriveFolders, saveDriveFolders } from "../../lib/firebase/users";
import { sha256Hex } from "../../lib/files/hash";
import { findPdfHints, type PdfHints } from "../../lib/pdf/hints";
import { readPdfFile } from "../../lib/pdf/pdf";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { versionsCol, worksCol } from "../works/refs";
import { defaultVersionLabel, mergeWorkIds } from "../works/model";
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

export type UploadResult =
  | {
      kind: "uploaded";
      workId: string;
      versionId: string;
      fileId: string;
      fileHash: string;
      /** PDF 에서 찾은 단서. 읽을 수 없는 PDF 면 없다 */
      hints?: PdfHints;
    }
  /** 같은 파일(SHA-256)이 이미 라이브러리에 있다. 드라이브에 올리지 않았다 (F-2.3) */
  | { kind: "duplicate"; workId: string; title: string; fileHash: string };

export interface UploadOptions {
  /** 지정하면 새 논문 대신 이 논문의 새 버전으로 추가한다 (기본 버전은 그대로) */
  workId?: string;
}

/** 같은 파일을 가진 논문을 찾는다. 논문의 fileHashes 에 모든 버전의 해시가 있다 */
export async function findWorkByFileHash(
  uid: string,
  fileHash: string,
): Promise<{ id: string; work: WorkDoc } | undefined> {
  const snap = await getDocs(
    query(worksCol(uid), where("fileHashes", "array-contains", fileHash), limit(1)),
  );
  const found = snap.docs[0];
  return found && { id: found.id, work: found.data() as WorkDoc };
}

/** PDF 앞쪽 텍스트에서 단서를 찾는다. 깨졌거나 암호가 걸린 PDF 는 단서 없이 올린다 */
async function readHints(file: File): Promise<PdfHints | undefined> {
  try {
    return findPdfHints(await readPdfFile(file));
  } catch (e) {
    console.warn(`PDF 를 읽지 못했습니다: ${file.name}`, e);
    return undefined;
  }
}

/**
 * 업로드한 PDF 의 버전 문서. arXiv ID 가 있으면 프리프린트로 본다.
 * 학회·저널 정보는 메타데이터 조회(M1-04) 후에 채운다.
 */
export function uploadedVersion(
  file: File,
  fileId: string,
  fileHash: string,
  hints: PdfHints | undefined,
): Writable<VersionDoc> {
  const ids: VersionDoc["ids"] = {
    ...(hints?.doi && { doi: hints.doi }),
    ...(hints?.arxiv && { arxiv: hints.arxiv }),
    ...(hints?.arxivVersion && { arxivVersion: hints.arxivVersion }),
  };
  const kind: VersionDoc["kind"] = ids.arxiv ? "preprint" : "other";
  return {
    schemaVersion: SCHEMA_VERSION,
    kind,
    label: defaultVersionLabel({ kind, ids }),
    ids,
    driveFileId: fileId,
    fileHash,
    fileName: file.name,
    fileSize: file.size,
    format: "pdf",
    ...(hints && { pageCount: hints.pageCount }),
    metadataSource: "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * PDF 를 올린다: 해시 → 중복 검사 → 드라이브 업로드 → 논문·버전 문서 (DevDocs/02-architecture.md §3.2).
 * 같은 파일이 이미 있으면 드라이브에 올리지 않고 duplicate 를 돌려준다.
 */
export async function uploadPdf(
  uid: string,
  file: File,
  { workId }: UploadOptions = {},
): Promise<UploadResult> {
  const fileHash = await sha256Hex(file);
  const existing = await findWorkByFileHash(uid, fileHash);
  if (existing) {
    return { kind: "duplicate", workId: existing.id, title: existing.work.title, fileHash };
  }

  const workRef = workId ? doc(worksCol(uid), workId) : doc(worksCol(uid));
  const versionRef = doc(versionsCol(uid, workRef.id));
  const hints = await readHints(file);
  const folders = await appFolders(uid);
  const { fileId } = await drive.uploadPdf({
    folders,
    workId: workRef.id,
    versionId: versionRef.id,
    file,
  });
  const version = uploadedVersion(file, fileId, fileHash, hints);
  const uploaded = {
    kind: "uploaded",
    workId: workRef.id,
    versionId: versionRef.id,
    fileId,
    fileHash,
    ...(hints && { hints }),
  } as const;

  if (workId) {
    await addVersion(uid, workId, versionRef, version);
    return uploaded;
  }

  const title = hints?.titleCandidates[0] ?? file.name.replace(/\.pdf$/i, "");
  const work: Writable<WorkDoc> = {
    schemaVersion: SCHEMA_VERSION,
    title,
    normTitle: normalizeTitle(title),
    authors: [],
    primaryVersionId: versionRef.id,
    ids: mergeWorkIds({}, version.ids),
    citeKey: `untitled-${workRef.id.slice(0, 6).toLowerCase()}`,
    collectionIds: [],
    tagIds: [],
    fileHashes: [fileHash],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // 논문과 기본 버전을 한 배치로 만든다 (보안 규칙이 기본 버전 존재를 검사)
  const batch = writeBatch(db);
  batch.set(workRef, work);
  batch.set(versionRef, version);
  await batch.commit();
  return uploaded;
}
