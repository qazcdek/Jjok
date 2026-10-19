// pdf-lib 으로 만든 PDF 를 node 용 pdf.js(legacy 빌드)로 읽어 extractFromPdf 를 검사한다.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { describe, expect, it } from "vitest";
import { extractFromPdf, findVenueHint, titleCandidatesFromLines } from "./pdfExtract";

interface FixtureLine {
  text: string;
  size: number;
  y: number;
  page?: number;
}

async function makePdf(lines: FixtureLine[], opts: { pages?: number; infoTitle?: string } = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = Array.from({ length: opts.pages ?? 1 }, () => pdf.addPage([612, 792]));
  for (const l of lines)
    pages[(l.page ?? 1) - 1]!.drawText(l.text, { x: 72, y: l.y, size: l.size, font });
  if (opts.infoTitle) pdf.setTitle(opts.infoTitle);
  return pdf.save();
}

async function open(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  return (await getDocument({ data: bytes, useSystemFonts: false })
    .promise) as unknown as PDFDocumentProxy;
}

describe("extractFromPdf", () => {
  it("arXiv 프리프린트: 여백 ID·버전, 두 줄 제목을 찾는다", async () => {
    const doc = await open(
      await makePdf([
        { text: "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023", size: 10, y: 760 },
        { text: "Attention Is All You Need for", size: 17, y: 700 },
        { text: "Sequence Transduction", size: 17, y: 680 },
        { text: "Ashish Vaswani, Noam Shazeer", size: 11, y: 640 },
        { text: "Abstract", size: 12, y: 600 },
        {
          text: "The dominant sequence transduction models are based on recurrent networks.",
          size: 10,
          y: 580,
        },
      ]),
    );
    const r = await extractFromPdf(doc);
    expect(r.arxiv).toEqual({ id: "1706.03762", version: 7 });
    expect(r.titleCandidates[0]).toBe("Attention Is All You Need for Sequence Transduction");
    expect(r.pageCount).toBe(1);
  });

  it("학회판: DOI 와 venue 문구를 찾는다", async () => {
    const doc = await open(
      await makePdf([
        { text: "Published as a conference paper at ICLR 2024", size: 9, y: 770 },
        { text: "Scaling Laws for Graph Neural Networks", size: 16, y: 700 },
        { text: "DOI: 10.1145/3580305.3599999", size: 9, y: 100 },
      ]),
    );
    const r = await extractFromPdf(doc);
    expect(r.doi).toBe("10.1145/3580305.3599999");
    expect(r.venueHint).toEqual({ venue: "ICLR", year: 2024, kind: "conference" });
    expect(r.titleCandidates[0]).toBe("Scaling Laws for Graph Neural Networks");
  });

  it("3페이지 이후(참고문헌)의 DOI 는 보지 않는다", async () => {
    const doc = await open(
      await makePdf(
        [
          { text: "A Paper Without Identifiers", size: 16, y: 700 },
          { text: "[12] Other paper. doi:10.1000/someone.else", size: 9, y: 300, page: 3 },
        ],
        { pages: 3 },
      ),
    );
    const r = await extractFromPdf(doc);
    expect(r.doi).toBeUndefined();
    expect(r.pageCount).toBe(3);
  });

  it("문서 정보 Title 은 쓸만할 때만 보조 후보로 넣는다", async () => {
    const good = await extractFromPdf(
      await open(
        await makePdf([{ text: "Body text only here", size: 10, y: 700 }], {
          infoTitle: "Deep Residual Learning for Image Recognition",
        }),
      ),
    );
    expect(good.titleCandidates).toContain("Deep Residual Learning for Image Recognition");
    const junk = await extractFromPdf(
      await open(
        await makePdf([{ text: "Body text only here", size: 10, y: 700 }], {
          infoTitle: "Microsoft Word - draft3.docx",
        }),
      ),
    );
    expect(junk.titleCandidates).not.toContain("Microsoft Word - draft3.docx");
  });
});

describe("titleCandidatesFromLines", () => {
  it("멀리 떨어진 같은 크기 줄은 따로 묶는다", () => {
    const c = titleCandidatesFromLines([
      { text: "Main Title of the Paper", size: 18, y: 700 },
      { text: "Section Heading Far Below", size: 18, y: 300 },
    ]);
    expect(c).toEqual(["Main Title of the Paper", "Section Heading Far Below"]);
  });

  it("각주 기호를 지운다", () => {
    expect(titleCandidatesFromLines([{ text: "A Great Title∗", size: 18, y: 700 }])).toEqual([
      "A Great Title",
    ]);
  });
});

describe("findVenueHint", () => {
  it.each([
    [
      "37th Conference on Neural Information Processing Systems (NeurIPS 2023).",
      { venue: "NeurIPS", year: 2023, kind: "conference" },
    ],
    [
      "Proceedings of the 40th International Conference on Machine Learning, ICML 2023",
      { venue: "ICML", year: 2023, kind: "conference" },
    ],
    [
      "Workshop on Efficient Systems for Foundation Models at ICML 2023",
      { venue: "ICML", year: 2023, kind: "workshop" },
    ],
    [
      "Published in Transactions on Machine Learning Research (2024)",
      { venue: "TMLR", year: 2024, kind: "journal" },
    ],
    [
      "Proceedings of NAACL-HLT 2019, pages 4171–4186",
      { venue: "NAACL", year: 2019, kind: "conference" },
    ],
    [
      "This CVPR 2016 paper is the Open Access version, provided by the Computer Vision Foundation.",
      { venue: "CVPR", year: 2016, kind: "conference" },
    ],
  ])("%s", (text, expected) => {
    expect(findVenueHint(text)).toEqual(expected);
  });

  it("단서가 없으면 undefined", () => {
    expect(findVenueHint("Some text about ICMLE and accent")).toBeUndefined();
  });
});
