// BibTeX 인용 키 (M1-11): <제1저자 성><연도><제목 첫 단어>, 예: vaswani2017attention
// 같은 키가 있으면 b, c, … 를 붙인다 (vaswani2017attentionb).

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "on",
  "of",
  "for",
  "in",
  "to",
  "with",
  "and",
  "towards",
  "toward",
  "via",
  "is",
  "are",
  "at",
  "by",
  "from",
  "how",
  "what",
  "why",
  "do",
  "does",
  "can",
]);

/** 영문 소문자·숫자만 남긴다 (악센트 제거). 남는 게 없으면 "" */
function ascii(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface CiteKeyInput {
  authors: { name: string; family?: string }[];
  year?: number;
  title: string;
}

export function makeCiteKey({ authors, year, title }: CiteKeyInput): string {
  const first = authors[0];
  const family = first ? ascii(first.family ?? first.name.trim().split(/\s+/).at(-1) ?? "") : "";
  const word =
    title
      .split(/[^\p{L}\p{N}]+/u)
      .map(ascii)
      .find((w) => w.length > 1 && !STOPWORDS.has(w)) ?? "";
  return `${family || "anon"}${year ?? ""}${word}` || "untitled";
}

/** 이미 쓰인 키 집합을 보고 유일한 키를 만든다 */
export function uniqueCiteKey(base: string, taken: (key: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 1; i < 26; i++) {
    const key = base + String.fromCharCode(97 + i); // b, c, …
    if (!taken(key)) return key;
  }
  return `${base}${Date.now().toString(36)}`;
}
