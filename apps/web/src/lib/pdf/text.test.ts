// pdf.js 로 실제 PDF 를 읽는 통합 테스트 (Node 에서는 legacy 빌드)
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { findPdfHints } from "./hints";
import { makeTextPdf } from "./testing";
import { readPdfText } from "./text";

async function read(data: Uint8Array) {
  const task = pdfjs.getDocument({ data });
  try {
    return await readPdfText(await task.promise);
  } finally {
    await task.destroy();
  }
}

describe("readPdfText", () => {
  it("줄마다 글자 크기와 위치를 읽고, 단서를 찾을 수 있다", async () => {
    const text = await read(
      makeTextPdf(
        [
          { text: "Attention Is All You Need", size: 17, y: 700 },
          { text: "Ashish Vaswani (Google Brain)", size: 11, y: 670 },
          { text: "The dominant sequence transduction models are based on", size: 10, y: 500 },
          { text: "complex recurrent or convolutional neural networks.", size: 10, y: 488 },
          { text: "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023", size: 20, y: 300, x: 20 },
        ],
        { infoTitle: "Attention Is All You Need" },
      ),
    );
    expect(text.pageCount).toBe(1);
    expect(text.infoTitle).toBe("Attention Is All You Need");
    expect(text.lines[0]).toMatchObject({ page: 1, text: "Attention Is All You Need", size: 17 });
    expect(text.lines[0]!.top).toBeCloseTo(92 / 792, 2);

    expect(findPdfHints(text)).toMatchObject({
      arxiv: "1706.03762",
      arxivVersion: 7,
      titleCandidates: ["Attention Is All You Need", "Ashish Vaswani (Google Brain)"],
    });
  });
});
