// 업로드한 PDF 의 메타데이터를 백엔드 서버 metadata-lookup 으로 찾아 논문·버전에 채운다 (M1-T4, F-1.2)
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { callTool } from "../../lib/api/client";
import { db } from "../../lib/firebase/app";
import type { PdfHints } from "../../lib/pdf/hints";
import type {
  MetadataLookupInput,
  MetadataLookupOutput,
  PaperMetadata,
  VersionDoc,
  WorkDoc,
} from "../../lib/schema";
import { defaultVersionLabel } from "../works/model";
import { versionsCol, workRef } from "../works/refs";
import { normalizeTitle } from "./uploads";

export type MetadataOutcome = MetadataLookupOutput["status"] | "skipped" | "failed";

/** PDF 단서로 조회 입력을 만든다. 단서가 하나도 없으면 undefined */
export function lookupInput(hints: PdfHints | undefined): MetadataLookupInput | undefined {
  if (!hints) return undefined;
  const input: MetadataLookupInput = {
    ...(hints.doi && { doi: hints.doi }),
    ...(hints.arxiv && { arxiv: hints.arxiv }),
    ...(hints.titleCandidates[0] && { title: hints.titleCandidates[0] }),
  };
  return Object.keys(input).length > 0 ? input : undefined;
}

export function lookupMetadata(input: MetadataLookupInput) {
  return callTool<MetadataLookupInput, MetadataLookupOutput>("metadata-lookup", input);
}

type Ids = WorkDoc["ids"];

const WORK_ID_KEYS = ["doi", "arxiv", "openreview", "s2", "openalex", "dblp"] as const;

/** 비어 있는 식별자만 채운다. 논문 식별자가 아닌 값(arxivVersion 등)은 버린다 */
export function fillIds(current: Ids, extra: object): Ids {
  const merged: Ids = { ...current };
  for (const key of WORK_ID_KEYS) {
    const value = (extra as Record<string, unknown>)[key];
    if (typeof value === "string" && value && !merged[key]) merged[key] = value;
  }
  return merged;
}

export interface MetadataPatch {
  work: Partial<WorkDoc>;
  version: Partial<VersionDoc>;
}

/**
 * 찾은 메타데이터를 논문·버전에 반영할 값을 계산한다.
 * - 새로 만든 논문이면 제목·저자·연도·학회·저널·초록을 채운다. 기존 논문에 추가한 버전이면 식별자만 합친다.
 * - 식별자로 찾은 결과는 이 PDF 와 같은 버전이므로 버전 종류·학회·저널·연도도 채운다.
 *   제목 검색 결과는 같은 논문의 다른 버전일 수 있어 버전에는 쓰지 않는다.
 * - 버전 이름은 사용자가 바꾸지 않았을 때(기본값과 같을 때)만 다시 정한다.
 */
export function metadataPatch(
  meta: PaperMetadata,
  work: Pick<WorkDoc, "ids">,
  version: Pick<VersionDoc, "kind" | "ids" | "venue" | "year" | "label">,
  { newWork }: { newWork: boolean },
): MetadataPatch {
  const fromIdentifier = meta.method === "identifier";
  // 프리프린트(arXiv) 결과가 가리키는 출판본 DOI 는 버전이 아니라 논문 식별자로만 둔다
  const versionIds: VersionDoc["ids"] = { ...version.ids };
  if (fromIdentifier && meta.ids.arxiv && !versionIds.arxiv) versionIds.arxiv = meta.ids.arxiv;
  if (fromIdentifier && meta.kind !== "preprint" && meta.ids.doi && !versionIds.doi) {
    versionIds.doi = meta.ids.doi;
  }

  const versionPatch: Partial<VersionDoc> = {
    metadataSource: fromIdentifier ? "identifier" : "title-search",
    ids: versionIds,
  };
  if (fromIdentifier) {
    versionPatch.kind = meta.kind;
    if (meta.year !== undefined) versionPatch.year = meta.year;
    if (meta.venue && meta.kind !== "preprint") versionPatch.venue = meta.venue;
  }
  const next = { ...version, ...versionPatch };
  const label = defaultVersionLabel(next);
  if (version.label === defaultVersionLabel(version) && label !== version.label) {
    versionPatch.label = label;
  }

  const workPatch: Partial<WorkDoc> = { ids: fillIds(fillIds(work.ids, versionIds), meta.ids) };
  if (newWork) {
    workPatch.title = meta.title;
    workPatch.normTitle = normalizeTitle(meta.title);
    workPatch.authors = meta.authors.map((a) => ({ ...a }));
    if (meta.year !== undefined) workPatch.year = meta.year;
    if (meta.venue && meta.kind !== "preprint") workPatch.venue = meta.venue;
    if (meta.abstract) workPatch.abstract = meta.abstract;
  }
  return { work: workPatch, version: versionPatch };
}

/**
 * 업로드한 버전의 메타데이터를 찾아 채운다. 찾지 못하거나 서버에 닿지 못해도 업로드는 그대로 둔다.
 * ambiguous(제목 후보만 있음)는 채우지 않는다: 사용자 확인은 M1-T5.
 */
export async function fillMetadata(
  uid: string,
  {
    workId,
    versionId,
    hints,
    newWork,
  }: {
    workId: string;
    versionId: string;
    hints?: PdfHints;
    newWork: boolean;
  },
): Promise<{ outcome: MetadataOutcome; result?: MetadataLookupOutput }> {
  const input = lookupInput(hints);
  if (!input) return { outcome: "skipped" };
  let result: MetadataLookupOutput;
  try {
    result = await lookupMetadata(input);
  } catch (e) {
    console.warn("메타데이터 조회 실패", e);
    return { outcome: "failed" };
  }
  if (result.status !== "found" || !result.match) return { outcome: result.status, result };

  const wRef = workRef(uid, workId);
  const vRef = doc(versionsCol(uid, workId), versionId);
  const [workSnap, versionSnap] = await Promise.all([getDoc(wRef), getDoc(vRef)]);
  if (!workSnap.exists() || !versionSnap.exists()) return { outcome: "skipped", result };
  const patch = metadataPatch(
    result.match,
    workSnap.data() as WorkDoc,
    versionSnap.data() as VersionDoc,
    { newWork },
  );
  const batch = writeBatch(db);
  batch.update(wRef, { ...patch.work, updatedAt: serverTimestamp() });
  batch.update(vRef, { ...patch.version, updatedAt: serverTimestamp() });
  await batch.commit();
  return { outcome: "found", result };
}
