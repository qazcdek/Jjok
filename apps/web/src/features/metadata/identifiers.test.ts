import { describe, expect, it } from "vitest";
import {
  findArxivId,
  findDoi,
  findOpenReviewId,
  normalizeDoi,
  parseIdentifierInput,
} from "./identifiers";

describe("normalizeDoi", () => {
  it.each([
    ["10.1145/3292500.3330701", "10.1145/3292500.3330701"],
    ["https://doi.org/10.18653/v1/N19-1423", "10.18653/v1/n19-1423"],
    ["doi:10.1109/CVPR.2016.90.", "10.1109/cvpr.2016.90"],
    ["(10.1038/nature14539)", "10.1038/nature14539"],
    ["10.1016/S0140-6736(20)30183-5", "10.1016/s0140-6736(20)30183-5"],
    ["10.1016/S0140-6736(20)30183-5).", "10.1016/s0140-6736(20)30183-5"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeDoi(input)).toBe(expected);
  });

  it("DOI 가 아니면 null", () => {
    expect(normalizeDoi("hello")).toBeNull();
  });
});

describe("findDoi", () => {
  it("본문 첫 DOI 를 찾는다", () => {
    expect(findDoi("Proceedings ... DOI: 10.18653/v1/2020.acl-main.1 and more")).toBe(
      "10.18653/v1/2020.acl-main.1",
    );
  });

  it("arXiv DOI(10.48550)는 건너뛴다", () => {
    expect(findDoi("https://doi.org/10.48550/arXiv.1706.03762 see 10.1145/123.456")).toBe(
      "10.1145/123.456",
    );
  });
});

describe("findArxivId", () => {
  it("arXiv 여백 표기에서 ID 와 버전을 찾는다", () => {
    expect(findArxivId("arXiv:1706.03762v7 [cs.CL] 2 Aug 2023")).toEqual({
      id: "1706.03762",
      version: 7,
    });
  });

  it("arxiv.org 주소", () => {
    expect(findArxivId("see https://arxiv.org/abs/2401.01234")).toEqual({ id: "2401.01234" });
  });

  it("옛 형식", () => {
    expect(findArxivId("arXiv:hep-th/9901001v2")).toEqual({ id: "hep-th/9901001", version: 2 });
  });

  it("접두사 없는 숫자는 arXiv 로 보지 않는다 (오탐 방지)", () => {
    expect(findArxivId("Table 2017.12345 shows")).toBeNull();
  });
});

describe("findOpenReviewId", () => {
  it("forum·pdf 주소", () => {
    expect(findOpenReviewId("https://openreview.net/forum?id=YicbFdNTTy")).toBe("YicbFdNTTy");
    expect(findOpenReviewId("https://openreview.net/pdf?id=a_b-C1")).toBe("a_b-C1");
  });
});

describe("parseIdentifierInput", () => {
  it.each([
    ["1706.03762", { kind: "arxiv", arxiv: { id: "1706.03762" } }],
    ["arXiv:1706.03762v5", { kind: "arxiv", arxiv: { id: "1706.03762", version: 5 } }],
    [
      "https://arxiv.org/pdf/2401.01234v2",
      { kind: "arxiv", arxiv: { id: "2401.01234", version: 2 } },
    ],
    ["10.48550/arXiv.1706.03762", { kind: "arxiv", arxiv: { id: "1706.03762" } }],
    ["https://doi.org/10.1145/3292500.3330701", { kind: "doi", doi: "10.1145/3292500.3330701" }],
    ["https://openreview.net/forum?id=YicbFdNTTy", { kind: "openreview", id: "YicbFdNTTy" }],
  ])("%s", (input, expected) => {
    expect(parseIdentifierInput(input)).toEqual(expected);
  });

  it("알 수 없는 입력은 null", () => {
    expect(parseIdentifierInput("attention is all you need")).toBeNull();
    expect(parseIdentifierInput("  ")).toBeNull();
  });
});
