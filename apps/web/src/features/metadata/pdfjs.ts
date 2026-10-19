// 브라우저용 pdf.js 로더. 워커는 Vite 가 별도 파일로 내보낸다.
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdf(file: Blob): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await file.arrayBuffer());
  return getDocument({ data }).promise;
}
