// 폴더 안의 PDF 마다 extractFromPdf 결과를 출력한다 (M1-12 평가의 추출 단계).
// 정답 비교·조회 단계는 M1-04 이후 이 파일에 붙인다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { it } from "vitest";
import { extractFromPdf } from "../../src/features/metadata/pdfExtract";

const dir = process.env.PDF_DIR;

it.skipIf(!dir)("PDF 추출 결과", async () => {
  const files = readdirSync(dir!)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .sort();
  for (const f of files) {
    const data = new Uint8Array(readFileSync(join(dir!, f)));
    const task = getDocument({ data });
    const doc = (await task.promise) as unknown as PDFDocumentProxy;
    const r = await extractFromPdf(doc);
    // vitest 는 통과한 테스트의 console 출력을 숨기므로 stdout 에 직접 쓴다
    process.stdout.write(`${JSON.stringify({ file: f, ...r })}\n`);
    await task.destroy();
  }
});
