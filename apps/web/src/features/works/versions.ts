// 판 추가 · 대표 버전 지정 · 판 삭제 (F-1.4, F-1.4.1)
// 무결성(대표 버전이 실제 판을 가리킴)은 보안 규칙이 서버에서 다시 확인한다: firebase/firestore.rules
// 트랜잭션 대신 배치를 쓴다: 오프라인 캐시에서도 쓰기가 되고, 한 사용자만 쓰는 데이터라 경합이 거의 없다.
import {
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { drive } from "../../lib/drive";
import { db } from "../../lib/firebase/app";
import type { Writable } from "../../lib/firebase/types";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { versionsCol, workRef } from "./refs";
import { mergeWorkIds, pickPrimaryVersion } from "./model";

/** 기존 작품에 판을 추가한다. 판의 식별자는 작품 식별자에 합친다. */
export async function addVersion(
  uid: string,
  workId: string,
  versionRef: DocumentReference,
  version: Writable<VersionDoc>,
  { makePrimary = false }: { makePrimary?: boolean } = {},
): Promise<void> {
  const work = await getDoc(workRef(uid, workId));
  if (!work.exists()) throw new Error(`작품이 없습니다: ${workId}`);
  const { ids } = work.data() as WorkDoc;
  const batch = writeBatch(db);
  batch.set(versionRef, version);
  batch.update(work.ref, {
    ids: mergeWorkIds(ids, version.ids),
    ...(makePrimary && { primaryVersionId: versionRef.id }),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** 대표 버전(기본으로 열리는 판)을 바꾼다 (F-1.4.1) */
export async function setPrimaryVersion(uid: string, workId: string, versionId: string) {
  await updateDoc(workRef(uid, workId), {
    primaryVersionId: versionId,
    updatedAt: serverTimestamp(),
  });
}

export type DeleteVersionResult =
  { kind: "version-deleted"; newPrimaryVersionId?: string } | { kind: "work-deleted" };

/**
 * 판을 지운다. 대표 버전이면 남은 판에서 새 대표를 고르고, 마지막 판이면 작품도 지운다.
 * 드라이브 파일은 Firestore 반영 후 지운다. 드라이브 삭제가 실패해도 데이터는 이미 지워졌으므로
 * 오류를 던지지 않고 결과만 남긴다 (고아 파일은 사용자 드라이브의 /Jjok 폴더에 남는다).
 */
export async function deleteVersion(
  uid: string,
  workId: string,
  versionId: string,
): Promise<DeleteVersionResult> {
  const wRef = workRef(uid, workId);
  const [workSnap, versionsSnap] = await Promise.all([
    getDoc(wRef),
    getDocs(versionsCol(uid, workId)),
  ]);
  if (!workSnap.exists()) throw new Error(`작품이 없습니다: ${workId}`);
  const work = workSnap.data() as WorkDoc;
  const target = versionsSnap.docs.find((d) => d.id === versionId);
  if (!target) throw new Error(`판이 없습니다: ${versionId}`);
  const driveFileId = (target.data() as VersionDoc).driveFileId;
  const others = versionsSnap.docs
    .filter((d) => d.id !== versionId)
    .map((d) => ({ ...(d.data() as VersionDoc), id: d.id }));

  const batch = writeBatch(db);
  batch.delete(target.ref);
  let result: DeleteVersionResult;
  if (others.length === 0) {
    batch.delete(wRef);
    result = { kind: "work-deleted" };
  } else if (work.primaryVersionId === versionId) {
    const next = pickPrimaryVersion(others)!;
    batch.update(wRef, { primaryVersionId: next.id, updatedAt: serverTimestamp() });
    result = { kind: "version-deleted", newPrimaryVersionId: next.id };
  } else {
    result = { kind: "version-deleted" };
  }
  await batch.commit();

  if (driveFileId) {
    await drive.remove(driveFileId).catch((e: unknown) => {
      console.warn("드라이브 파일 삭제 실패 (데이터는 삭제됨)", driveFileId, e);
    });
  }
  return result;
}
