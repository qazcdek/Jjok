// PDF 앞부분에서 식별자·제목 후보·venue 단서를 뽑는다 (F-1.2, M1-03).
// pdf.js 문서 객체를 받기만 하므로 브라우저(pdfjs.ts)와 테스트(node) 양쪽에서 같은 코드를 쓴다.
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { findArxivId, findDoi, findOpenReviewId, type ArxivId } from "./identifiers";

export interface PdfExtraction {
  doi?: string;
  arxiv?: ArxivId;
  openreview?: string;
  /** 가능성 높은 순서. [0] 은 1페이지에서 가장 큰 글씨 */
  titleCandidates: string[];
  /** "Published as a conference paper at ICLR 2024" 같은 문구에서 찾은 venue */
  venueHint?: { venue: string; year?: number; kind: "conference" | "workshop" | "journal" };
  pageCount: number;
}

/** 식별자를 찾을 때 보는 페이지 수. 뒤쪽 참고문헌의 남의 DOI 를 피한다. */
const ID_PAGES = 2;

interface Line {
  text: string;
  size: number;
  y: number;
}

function isTextItem(item: unknown): item is TextItem {
  return typeof (item as TextItem).str === "string";
}

/** 같은 줄(같은 y, 같은 글씨 크기)의 조각을 이어 붙인다 */
function toLines(items: TextItem[]): Line[] {
  const lines: Line[] = [];
  for (const it of items) {
    const text = it.str;
    if (!text.trim()) continue;
    const size =
      Math.round(Math.hypot(it.transform[2] as number, it.transform[3] as number) * 10) / 10;
    const y = Math.round(it.transform[5] as number);
    const last = lines.at(-1);
    if (last && Math.abs(last.y - y) <= 2 && Math.abs(last.size - size) < 0.5) {
      last.text += (last.text.endsWith(" ") || text.startsWith(" ") ? "" : " ") + text;
    } else {
      lines.push({ text, size, y });
    }
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }));
}

const NOT_TITLE = /^(arxiv:|preprint|under review|published as|proceedings|abstract$)/i;

/** 1페이지에서 글씨가 큰 줄 묶음을 제목 후보로 만든다 */
export function titleCandidatesFromLines(lines: Line[]): string[] {
  const usable = lines.filter((l) => l.text.length >= 3 && !NOT_TITLE.test(l.text));
  const sizes = [...new Set(usable.map((l) => l.size))].sort((a, b) => b - a);
  const candidates: string[] = [];
  for (const size of sizes.slice(0, 3)) {
    // 같은 크기에서 위아래로 이어진 줄(제목이 두 줄인 경우)을 합친다
    const group = usable.filter((l) => l.size === size).sort((a, b) => b.y - a.y);
    let block: Line[] = [];
    const flush = () => {
      if (block.length) candidates.push(block.map((l) => l.text).join(" "));
      block = [];
    };
    for (const l of group) {
      const prev = block.at(-1);
      if (prev && prev.y - l.y > size * 2) flush();
      block.push(l);
    }
    flush();
  }
  return [...new Set(candidates)]
    .map((t) => t.replace(/[∗*†‡§¶]+$/u, "").trim())
    .filter((t) => t.length >= 8 && t.length <= 300 && /[\p{L}]{3,}/u.test(t))
    .slice(0, 3);
}

const VENUES =
  "NeurIPS|NIPS|ICML|ICLR|CVPR|ICCV|ECCV|ACL|EMNLP|NAACL|AAAI|IJCAI|KDD|SIGIR|WWW|COLING|TACL|TMLR|JMLR";
const VENUE_PATTERNS: Array<{ re: RegExp; kind: "conference" | "workshop" | "journal" }> = [
  {
    re: new RegExp(String.raw`workshop[^\n]{0,80}?\b(${VENUES})\b\s*'?(\d{2,4})?`, "i"),
    kind: "workshop",
  },
  { re: new RegExp(String.raw`\b(${VENUES})\b[^\n]{0,20}?workshop`, "i"), kind: "workshop" },
  {
    re: new RegExp(String.raw`published as a conference paper at (${VENUES})\s*(\d{4})?`, "i"),
    kind: "conference",
  },
  // CVF Open Access 워터마크: "This CVPR 2016 paper is the Open Access version, provided by ..."
  {
    re: new RegExp(
      String.raw`this (${VENUES}) (\d{4}) (?:workshop )?paper is the open access version`,
      "i",
    ),
    kind: "conference",
  },
  { re: new RegExp(String.raw`\((${VENUES})\s*(\d{4})\)`, "i"), kind: "conference" },
  {
    // "Proceedings of NAACL-HLT 2019" 처럼 -HLT 가 붙는 경우 포함
    re: new RegExp(
      String.raw`proceedings of[^\n]{0,120}?\b(${VENUES})\b(?:-HLT)?\s*'?(\d{2,4})?`,
      "i",
    ),
    kind: "conference",
  },
  {
    re: /\b(Transactions on Machine Learning Research|Journal of Machine Learning Research)\b(?:[^\n]{0,20}?(\d{4}))?/i,
    kind: "journal",
  },
];

const CANONICAL: Record<string, string> = {
  nips: "NeurIPS",
  "transactions on machine learning research": "TMLR",
  "journal of machine learning research": "JMLR",
};

function canonicalVenue(raw: string): string {
  return CANONICAL[raw.toLowerCase()] ?? raw.toUpperCase().replace("NEURIPS", "NeurIPS");
}

function toYear(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (raw.length === 2) return 2000 + n;
  return n >= 1950 && n <= 2100 ? n : undefined;
}

export function findVenueHint(text: string): PdfExtraction["venueHint"] {
  for (const { re, kind } of VENUE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const year = toYear(m[2]);
      return { venue: canonicalVenue(m[1]!), kind, ...(year ? { year } : {}) };
    }
  }
  return undefined;
}

export async function extractFromPdf(doc: PDFDocumentProxy): Promise<PdfExtraction> {
  const pageTexts: string[] = [];
  let firstPageLines: Line[] = [];
  for (let n = 1; n <= Math.min(ID_PAGES, doc.numPages); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const items = content.items.filter(isTextItem);
    const lines = toLines(items);
    if (n === 1) firstPageLines = lines;
    pageTexts.push(lines.map((l) => l.text).join("\n"));
  }
  const text = pageTexts.join("\n");

  const titleCandidates = titleCandidatesFromLines(firstPageLines);
  // PDF 문서 정보의 Title 은 "Microsoft Word - draft3.docx" 같은 값이 많아 보조 후보로만 쓴다
  const { info } = await doc.getMetadata().catch(() => ({ info: {} }));
  const infoTitle = (info as { Title?: unknown }).Title;
  if (
    typeof infoTitle === "string" &&
    infoTitle.trim().length >= 8 &&
    !/\.(docx?|tex|pdf|dvi)$|^untitled|microsoft word/i.test(infoTitle.trim())
  ) {
    const t = infoTitle.trim();
    if (!titleCandidates.some((c) => c.toLowerCase() === t.toLowerCase())) titleCandidates.push(t);
  }

  const doi = findDoi(text);
  const arxiv = findArxivId(text);
  const openreview = findOpenReviewId(text);
  const venueHint = findVenueHint(text);
  return {
    ...(doi ? { doi } : {}),
    ...(arxiv ? { arxiv } : {}),
    ...(openreview ? { openreview } : {}),
    ...(venueHint ? { venueHint } : {}),
    titleCandidates,
    pageCount: doc.numPages,
  };
}
