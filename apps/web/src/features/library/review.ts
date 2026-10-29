// 메타데이터 확인·수동 입력 (M1-T5, F-1.2): 자동으로 확정하지 못한 논문을 사용자가 고친다.
// 다시 찾기(DOI·arXiv ID·제목) → 후보 고르기, 또는 직접 입력, 또는 지금 정보로 확정.
import {
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type FieldValue,
} from "firebase/firestore";
import { db } from "../../lib/firebase/app";
import { findArxivId, findDoi } from "../../lib/pdf/hints";
import type {
  MetadataLookupInput,
  MetadataLookupOutput,
  PaperMetadata,
  WorkDoc,
} from "../../lib/schema";
import { versionsCol, workRef } from "../works/refs";
import { applyMetadata, lookupMetadata } from "./metadata";
import { normalizeTitle } from "./uploads";

const BARE_ARXIV = /^(?:arxiv\s*:\s*)?(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i;

/**
 * 검색창 입력을 조회 입력으로 바꾼다. DOI(주소 포함) → arXiv ID(숫자만 있어도 됨) → 제목 순.
 * PDF 본문과 달리 사용자가 직접 넣은 값이라 접두사 없는 arXiv ID 도 받는다.
 */
export function parseLookupQuery(text: string): MetadataLookupInput | undefined {
  const q = text.trim();
  if (!q) return undefined;
  const arxiv = BARE_ARXIV.exec(q)?.[1] ?? findArxivId(q)?.id;
  if (arxiv) return { arxiv };
  const doi = findDoi(q);
  if (doi) return { doi };
  return { title: q.slice(0, 500) };
}

/** 저자 표시: 앞 max 명, 나머지는 "외 n명" */
export function authorsText(authors: readonly { name: string }[], max = 3): string {
  const names = authors.slice(0, max).map((a) => a.name);
  return authors.length > max
    ? `${names.join(", ")} 외 ${authors.length - max}명`
    : names.join(", ");
}

/** 조회 결과를 화면에 보일 후보 목록으로: match 를 맨 앞에 */
export function candidatesOf(result: MetadataLookupOutput): PaperMetadata[] {
  return result.match ? [result.match, ...result.candidates] : result.candidates;
}

export async function searchCandidates(query: string): Promise<PaperMetadata[]> {
  const input = parseLookupQuery(query);
  if (!input) return [];
  return candidatesOf(await lookupMetadata(input));
}

/** 후보를 이 논문의 정보로 확정한다. 논문 정보를 덮어쓰고, 같은 판이면 기본 버전도 채운다 */
export async function confirmCandidate(
  uid: string,
  workId: string,
  work: Pick<WorkDoc, "primaryVersionId">,
  meta: PaperMetadata,
): Promise<void> {
  const ok = await applyMetadata(uid, { workId, versionId: work.primaryVersionId }, meta, {
    newWork: true,
  });
  if (!ok) throw new Error("논문이 삭제되었습니다.");
}

export interface ManualInput {
  title: string;
  /** 쉼표 또는 줄바꿈으로 구분 */
  authors: string;
  year: string;
  venue: string;
}

/** 쉼표·줄바꿈으로 나눈 저자 이름 */
export function parseAuthors(text: string): WorkDoc["authors"] {
  return text
    .split(/[,\n]/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((name) => ({ name }));
}

export interface ManualPatch {
  title: string;
  normTitle: string;
  authors: WorkDoc["authors"];
  /** 비우면 필드를 지운다 */
  year: number | FieldValue;
  venue: string | FieldValue;
  needsReview: false;
}

/** 직접 입력한 값을 검사해 논문 패치로 만든다. 잘못된 값이면 화면에 보일 문구를 던진다 */
export function manualPatch(input: ManualInput, now = new Date()): ManualPatch {
  const title = input.title.trim().replace(/\s+/g, " ");
  if (!title) throw new Error("제목을 입력하세요.");
  const yearText = input.year.trim();
  let year: number | FieldValue = deleteField();
  if (yearText) {
    const n = Number(yearText);
    if (!/^\d{4}$/.test(yearText) || n < 1900 || n > now.getFullYear() + 1) {
      throw new Error("연도는 네 자리 숫자로 입력하세요.");
    }
    year = n;
  }
  const venue = input.venue.trim();
  return {
    title,
    normTitle: normalizeTitle(title),
    authors: parseAuthors(input.authors),
    year,
    venue: venue || deleteField(),
    needsReview: false,
  };
}

/** 직접 입력한 정보로 확정한다. 기본 버전의 정보 출처는 manual 로 남긴다 (N-03 평가) */
export async function saveManual(
  uid: string,
  workId: string,
  work: Pick<WorkDoc, "primaryVersionId">,
  input: ManualInput,
): Promise<void> {
  const patch = manualPatch(input);
  const batch = writeBatch(db);
  batch.update(workRef(uid, workId), { ...patch, updatedAt: serverTimestamp() });
  batch.update(doc(versionsCol(uid, workId), work.primaryVersionId), {
    metadataSource: "manual",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** 지금 정보가 맞다고 확정한다 (확인 필요 표시만 지운다) */
export async function confirmAsIs(uid: string, workId: string): Promise<void> {
  await updateDoc(workRef(uid, workId), { needsReview: false, updatedAt: serverTimestamp() });
}
