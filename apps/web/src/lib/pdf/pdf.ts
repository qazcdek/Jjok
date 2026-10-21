// 브라우저에서 pdf.js 로 PDF 를 연다. pdf.js 는 크기가 커서 처음 쓸 때 불러온다.
import type { PdfText } from "./text";

/** PDF 파일의 앞쪽 텍스트를 읽는다. 열 수 없는 PDF 면 오류를 던진다 */
export async function readPdfFile(file: Blob, maxPages = 2): Promise<PdfText> {
  const [pdfjs, { default: workerSrc }, { readPdfText }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    import("./text"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    return await readPdfText(await task.promise, maxPages);
  } finally {
    await task.destroy();
  }
}
