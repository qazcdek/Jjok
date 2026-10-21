// PDF 텍스트에서 메타데이터 조회에 쓸 단서(DOI, arXiv ID, 제목 후보)를 찾는다 (M1-T3, F-1.2).
// 순수 함수. 조회 자체는 백엔드 서버의 metadata-lookup 이 한다 (M1-T4).
import type { PdfText, TextLine } from "./text";

export interface PdfHints {
  doi?: string;
  arxiv?: string;
  arxivVersion?: number;
  /** 그럴듯한 순서. 첫 번째를 임시 제목으로 쓴다 */
  titleCandidates: string[];
  pageCount: number;
}

// 새 형식 2106.09685(v2), 옛 형식 hep-th/9901001(v1)
const ARXIV_ID = String.raw`(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v(\d+))?`;
const ARXIV_PATTERNS = [
  new RegExp(String.raw`arxiv\s*:\s*${ARXIV_ID}`, "i"),
  new RegExp(String.raw`arxiv\.org\/(?:abs|pdf)\/${ARXIV_ID}`, "i"),
  new RegExp(String.raw`10\.48550\/arxiv\.${ARXIV_ID}`, "i"),
];

/** arXiv ID. "arXiv:" 접두사나 arxiv.org 주소가 붙은 것만 본다 (숫자만 있는 것은 오탐이 많다) */
export function findArxivId(text: string): { id: string; version?: number } | undefined {
  for (const re of ARXIV_PATTERNS) {
    const m = re.exec(text);
    if (m?.[1]) return { id: m[1], ...(m[2] && { version: Number(m[2]) }) };
  }
  return undefined;
}

const DOI = /\b(10\.\d{4,9}\/[^\s"<>]+)/g;

/** DOI (소문자). arXiv DOI(10.48550)는 제외한다: arXiv ID 로 따로 잡는다 */
export function findDoi(text: string): string | undefined {
  for (const m of text.matchAll(DOI)) {
    const doi = m[1]!.replace(/[.,;:)\]}]+$/, "").toLowerCase();
    if (!doi.startsWith("10.48550/")) return doi;
  }
  return undefined;
}

// 제목이 될 수 없는 줄: 학회 머리말, 저작권, 저널 정보 등
const NOT_TITLE =
  /^(arxiv|preprint|published|proceedings|accepted|under review|workshop|journal|vol\.|volume|copyright|©|doi|https?:|www\.|abstract\b|keywords|received|issn|page \d)/i;

/** 문서 정보 Title 이 쓸모없는 값인지: 비었거나 파일 이름·워드 문서 이름 같은 것 */
function usableInfoTitle(title: string | undefined): title is string {
  if (!title) return false;
  if (/^(untitled|title|paper|main|article|document)$/i.test(title)) return false;
  if (/\.(pdf|docx?|tex|dvi|ps)$/i.test(title) || /^microsoft word/i.test(title)) return false;
  return title.split(/\s+/).length >= 2 && title.length <= 300;
}

function plausibleTitleLine(line: TextLine): boolean {
  const { text } = line;
  if (text.length < 4 || text.length > 250) return false;
  if (NOT_TITLE.test(text)) return false;
  if (!/\p{L}{2}/u.test(text)) return false; // 숫자·기호만
  if (/@/.test(text)) return false; // 이메일 줄
  return true;
}

/**
 * 첫 페이지 위쪽에서 글자가 가장 큰 줄들을 제목 후보로 고른다.
 * 크기가 같은 연속 줄은 여러 줄 제목으로 보고 합친다.
 */
function titleFromLayout(lines: TextLine[]): string[] {
  const first = lines.filter((l) => l.page === 1 && l.top < 0.6);
  const sizes = [...new Set(first.filter(plausibleTitleLine).map((l) => l.size))].sort(
    (a, b) => b - a,
  );
  // 본문보다 큰 글자만 (가장 흔한 크기 = 본문 크기)
  const counts = new Map<number, number>();
  for (const l of lines) counts.set(l.size, (counts.get(l.size) ?? 0) + l.text.length);
  const bodySize = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const candidates: string[] = [];
  for (const size of sizes.slice(0, 2)) {
    if (size <= bodySize && candidates.length > 0) break;
    let block: string[] = [];
    const blocks: string[] = [];
    for (const l of first) {
      if (Math.abs(l.size - size) < 0.5 && plausibleTitleLine(l)) {
        block.push(l.text);
      } else if (block.length > 0) {
        blocks.push(block.join(" "));
        block = [];
      }
    }
    if (block.length > 0) blocks.push(block.join(" "));
    // 300자를 넘는 블록은 제목이 아니라 본문일 가능성이 높다
    candidates.push(...blocks.filter((b) => b.length <= 300));
  }
  return candidates;
}

const cleanTitle = (t: string) =>
  t
    .replace(/\s+/g, " ")
    .replace(/[\s*†‡∗]+$/u, "")
    .trim();

/** PDF 텍스트에서 단서를 찾는다. 식별자는 1쪽을 먼저 보고 없으면 2쪽까지 본다 */
export function findPdfHints(pdf: PdfText): PdfHints {
  const pageText = (n: number) =>
    pdf.lines
      .filter((l) => l.page === n)
      .map((l) => l.text)
      .join("\n");
  const texts = [pageText(1), pageText(2)];
  const arxiv = texts.map(findArxivId).find(Boolean);
  const doi = texts.map(findDoi).find(Boolean);

  const titles: string[] = [];
  const push = (t: string) => {
    const clean = cleanTitle(t);
    if (clean && !titles.some((x) => x.toLowerCase() === clean.toLowerCase())) titles.push(clean);
  };
  titleFromLayout(pdf.lines).forEach(push);
  // 문서 정보 Title 은 틀린 값이 많아 레이아웃 후보 다음에 둔다. 레이아웃 후보가 없을 때만 1순위
  if (usableInfoTitle(pdf.infoTitle)) push(pdf.infoTitle);

  return {
    ...(doi && { doi }),
    ...(arxiv && { arxiv: arxiv.id }),
    ...(arxiv?.version && { arxivVersion: arxiv.version }),
    titleCandidates: titles.slice(0, 5),
    pageCount: pdf.pageCount,
  };
}
