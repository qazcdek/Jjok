// pdf.js 문서에서 앞쪽 페이지의 텍스트 줄을 읽는다 (M1-03). 브라우저·Node 공용.
// pdf.js 를 직접 import 하지 않고 문서 객체만 받는다: 브라우저는 pdf.ts, 테스트는 legacy 빌드를 쓴다.
import type { PDFDocumentProxy } from "pdfjs-dist";

/** 한 줄의 텍스트. 같은 y 좌표에 놓인 글자 조각을 합친 것 */
export interface TextLine {
  page: number;
  text: string;
  /** 줄에서 가장 큰 글자 크기 (pt) */
  size: number;
  /** 페이지 위에서부터 비율 (0 = 맨 위, 1 = 맨 아래) */
  top: number;
}

export interface PdfText {
  pageCount: number;
  /** PDF 문서 정보의 Title. 비어 있거나 쓸모없는 값도 그대로 둔다 */
  infoTitle?: string;
  lines: TextLine[];
}

interface Item {
  str: string;
  transform: number[];
  hasEOL: boolean;
}

const isItem = (it: object): it is Item => "str" in it && "transform" in it;

/** 앞쪽 maxPages 쪽의 텍스트를 줄 단위로 읽는다 */
export async function readPdfText(doc: PDFDocumentProxy, maxPages = 2): Promise<PdfText> {
  const lines: TextLine[] = [];
  for (let n = 1; n <= Math.min(maxPages, doc.numPages); n++) {
    const page = await doc.getPage(n);
    const height = page.view[3]! - page.view[1]!;
    const content = await page.getTextContent();
    let current: { text: string; size: number; y: number } | undefined;
    const flush = () => {
      const text = current?.text.replace(/\s+/g, " ").trim();
      if (current && text) {
        lines.push({ page: n, text, size: current.size, top: 1 - current.y / height });
      }
      current = undefined;
    };
    for (const it of content.items) {
      if (!isItem(it)) continue;
      const [, , c = 0, d = 0, , y = 0] = it.transform;
      const size = Math.round(Math.hypot(c, d) * 10) / 10;
      // 빈 조각(공백)은 크기·위치 판단에 쓰지 않는다
      if (it.str.trim() === "") {
        if (current) current.text += it.str;
      } else if (current && Math.abs(current.y - y) < Math.max(2, size * 0.3)) {
        current.text += it.str;
        current.size = Math.max(current.size, size);
      } else {
        flush();
        current = { text: it.str, size, y };
      }
      if (it.hasEOL) {
        if (current) current.text += " ";
      }
    }
    flush();
    page.cleanup();
  }
  const { info } = (await doc.getMetadata().catch(() => ({ info: {} }))) as {
    info: { Title?: unknown };
  };
  const infoTitle = typeof info.Title === "string" ? info.Title.trim() || undefined : undefined;
  return { pageCount: doc.numPages, ...(infoTitle && { infoTitle }), lines };
}
