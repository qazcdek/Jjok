// 텍스트에서 논문 식별자를 찾는다 (F-1.2, M1-03). PDF·사용자 입력(F-1.3) 모두에 쓴다.
// 오탐을 줄이려고 arXiv 번호는 "arXiv" 표기나 arxiv.org 주소가 붙은 경우만 인정한다.

export interface ArxivId {
  /** 버전 접미사를 뗀 ID (예: 2401.01234, hep-th/9901001) */
  id: string;
  version?: number;
}

/** DOI 정규화: 접두사(doi:, https://doi.org/) 제거, 끝 문장부호 제거, 소문자 */
export function normalizeDoi(raw: string): string | null {
  const m = raw.trim().match(/10\.\d{4,9}\/\S+/i);
  if (!m) return null;
  let doi = m[0].replace(/[.,;:'"\])>}]+$/, "");
  // 괄호가 DOI 안에서 열렸다면 닫는 괄호는 DOI 의 일부다 (예: 10.1016/S0140-6736(20)30183-5)
  const opens = (doi.match(/\(/g) ?? []).length;
  const closes = (doi.match(/\)/g) ?? []).length;
  if (opens > closes && m[0].charAt(doi.length) === ")") doi += ")";
  return doi.toLowerCase();
}

const DOI_RE = /(?:doi\s*[:.]?\s*|doi\.org\/)?(10\.\d{4,9}\/[^\s"'<>]+)/gi;

/** 본문에서 처음 나오는 DOI. 참고문헌의 DOI 를 피하려면 앞쪽 텍스트만 넘긴다. */
export function findDoi(text: string): string | null {
  for (const m of text.matchAll(DOI_RE)) {
    const doi = normalizeDoi(m[1]!);
    // arXiv 가 발급하는 DOI(10.48550/arxiv.*)는 arXiv ID 로 따로 잡히므로 DOI 로는 쓰지 않는다
    if (doi && !doi.startsWith("10.48550/")) return doi;
  }
  return null;
}

const ARXIV_NEW = String.raw`(\d{4}\.\d{4,5})(?:v(\d+))?`;
const ARXIV_OLD = String.raw`([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v(\d+))?`;
const ARXIV_RES = [
  new RegExp(String.raw`arxiv\s*:\s*${ARXIV_NEW}`, "i"),
  new RegExp(String.raw`arxiv\.org\/(?:abs|pdf)\/${ARXIV_NEW}`, "i"),
  new RegExp(String.raw`10\.48550\/arxiv\.${ARXIV_NEW}`, "i"),
  new RegExp(String.raw`arxiv\s*:\s*${ARXIV_OLD}`, "i"),
  new RegExp(String.raw`arxiv\.org\/(?:abs|pdf)\/${ARXIV_OLD}`, "i"),
];

export function findArxivId(text: string): ArxivId | null {
  for (const re of ARXIV_RES) {
    const m = text.match(re);
    if (m) return { id: m[1]!, ...(m[2] ? { version: Number(m[2]) } : {}) };
  }
  return null;
}

/** OpenReview forum ID (openreview.net/forum?id=... 또는 /pdf?id=...) */
export function findOpenReviewId(text: string): string | null {
  const m = text.match(/openreview\.net\/(?:forum|pdf)\?id=([A-Za-z0-9_-]+)/);
  return m ? m[1]! : null;
}

export type ParsedIdentifier =
  | { kind: "doi"; doi: string }
  | { kind: "arxiv"; arxiv: ArxivId }
  | { kind: "openreview"; id: string };

/**
 * 사용자가 입력한 식별자 한 개를 해석한다 (F-1.3).
 * 허용: DOI(접두사·URL 포함), arXiv ID(접두사 없이도 허용), arXiv·OpenReview URL
 */
export function parseIdentifierInput(input: string): ParsedIdentifier | null {
  const s = input.trim();
  if (!s) return null;
  const openreview = findOpenReviewId(s);
  if (openreview) return { kind: "openreview", id: openreview };
  const arxiv =
    findArxivId(s) ??
    // 입력란에서는 접두사 없는 arXiv 번호도 받는다
    findArxivId(`arXiv:${s.replace(/^arxiv\s*/i, "")}`);
  if (arxiv && !/^10\./.test(s.replace(/^(doi:|https?:\/\/(dx\.)?doi\.org\/)/i, ""))) {
    return { kind: "arxiv", arxiv };
  }
  const doi = normalizeDoi(s);
  if (doi) {
    const fromArxivDoi = doi.match(/^10\.48550\/arxiv\.(.+)$/);
    if (fromArxivDoi) {
      const a = findArxivId(`arXiv:${fromArxivDoi[1]}`);
      if (a) return { kind: "arxiv", arxiv: a };
    }
    return { kind: "doi", doi };
  }
  return null;
}
