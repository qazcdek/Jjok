import { describe, expect, it } from "vitest";
import { findArxivId, findDoi, findPdfHints } from "./hints";
import type { TextLine } from "./text";

describe("findArxivId", () => {
  it.each([
    ["arXiv:1706.03762v7 [cs.CL] 2 Aug 2023", { id: "1706.03762", version: 7 }],
    ["arXiv: 2106.09685", { id: "2106.09685" }],
    ["see https://arxiv.org/abs/2310.06825v1.", { id: "2310.06825", version: 1 }],
    ["https://doi.org/10.48550/arXiv.2005.14165", { id: "2005.14165" }],
    ["arXiv:hep-th/9901001v2", { id: "hep-th/9901001", version: 2 }],
    ["arXiv:math.GT/0309136", { id: "math.GT/0309136" }],
  ])("%s", (text, expected) => {
    expect(findArxivId(text)).toEqual(expected);
  });

  it("접두사 없는 숫자는 arXiv ID 로 보지 않는다", () => {
    expect(findArxivId("Table 1234.5678 shows")).toBeUndefined();
  });
});

describe("findDoi", () => {
  it.each([
    ["DOI: 10.1145/3292500.3330701.", "10.1145/3292500.3330701"],
    ["https://doi.org/10.1109/CVPR.2016.90)", "10.1109/cvpr.2016.90"],
    ["doi:10.18653/v1/N19-1423,", "10.18653/v1/n19-1423"],
  ])("%s", (text, expected) => {
    expect(findDoi(text)).toBe(expected);
  });

  it("arXiv DOI 는 건너뛰고 다음 DOI 를 본다", () => {
    expect(findDoi("10.48550/arXiv.1706.03762 and 10.5555/3295222.3295349")).toBe(
      "10.5555/3295222.3295349",
    );
  });

  it("DOI 가 없으면 undefined", () => {
    expect(findDoi("no identifiers here 10.5 / 3")).toBeUndefined();
  });
});

const line = (text: string, size: number, top: number, page = 1): TextLine => ({
  text,
  size,
  top,
  page,
});

const body = Array.from({ length: 30 }, (_, i) =>
  line("Body text of the paper that goes on for a while.", 10, 0.4 + i * 0.015),
);

describe("findPdfHints", () => {
  it("첫 페이지 위쪽의 가장 큰 글자를 제목으로, 여러 줄이면 합친다", () => {
    const hints = findPdfHints({
      pageCount: 12,
      infoTitle: "main.pdf",
      lines: [
        line("Published as a conference paper at ICLR 2024", 9, 0.05),
        line("LoRA: Low-Rank Adaptation of", 17, 0.1),
        line("Large Language Models *", 17, 0.13),
        line("Edward Hu  Yelong Shen", 11, 0.2),
        line("Abstract", 12, 0.3),
        ...body,
        line("arXiv:2106.09685v2 [cs.CL] 16 Oct 2021", 20, 0.5),
      ],
    });
    expect(hints).toEqual({
      arxiv: "2106.09685",
      arxivVersion: 2,
      titleCandidates: [
        "LoRA: Low-Rank Adaptation of Large Language Models",
        "Edward Hu Yelong Shen",
      ],
      pageCount: 12,
    });
  });

  it("레이아웃 후보 다음에 쓸 만한 문서 정보 Title 을 넣는다", () => {
    const hints = findPdfHints({
      pageCount: 1,
      infoTitle: "Deep Residual Learning for Image Recognition",
      lines: [line("Deep Residual Learning for Image Recognition", 14, 0.1), ...body],
    });
    expect(hints.titleCandidates).toEqual(["Deep Residual Learning for Image Recognition"]);
  });

  it("텍스트가 없는 PDF(스캔본)는 문서 정보 Title 만 쓰고, 그것도 없으면 후보 없음", () => {
    expect(
      findPdfHints({ pageCount: 3, infoTitle: "A Scanned Classic", lines: [] }).titleCandidates,
    ).toEqual(["A Scanned Classic"]);
    expect(findPdfHints({ pageCount: 3, infoTitle: "untitled", lines: [] })).toEqual({
      titleCandidates: [],
      pageCount: 3,
    });
  });

  it("DOI 는 1쪽에서 먼저 찾고, 없을 때만 2쪽을 본다", () => {
    const hints = findPdfHints({
      pageCount: 2,
      lines: [
        line("A Title Here", 16, 0.1),
        line("https://doi.org/10.1000/first", 8, 0.95),
        line("[1] doi:10.1000/reference", 8, 0.5, 2),
      ],
    });
    expect(hints.doi).toBe("10.1000/first");
  });
});
