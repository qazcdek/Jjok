import { describe, expect, it, vi } from "vitest";
import type { MetadataLookupOutput, PaperMetadata } from "../../lib/schema";

// review.ts 가 불러오는 Firebase 초기화를 막는다 (순수 함수만 시험)
vi.mock("../../lib/firebase/app", () => ({ db: {}, auth: {} }));
vi.mock("../../lib/drive", () => ({ drive: {} }));
const { authorsText, candidatesOf, manualPatch, parseAuthors, parseLookupQuery } =
  await import("./review");

describe("parseLookupQuery", () => {
  it("숫자만 있는 arXiv ID 와 버전 접미사, 접두사, 주소를 받는다", () => {
    expect(parseLookupQuery("1706.03762")).toEqual({ arxiv: "1706.03762" });
    expect(parseLookupQuery(" 1706.03762v7 ")).toEqual({ arxiv: "1706.03762" });
    expect(parseLookupQuery("arXiv:2106.09685")).toEqual({ arxiv: "2106.09685" });
    expect(parseLookupQuery("https://arxiv.org/abs/1706.03762v2")).toEqual({
      arxiv: "1706.03762",
    });
    expect(parseLookupQuery("hep-th/9901001")).toEqual({ arxiv: "hep-th/9901001" });
  });

  it("DOI 는 주소에서도 찾고 소문자로 바꾼다", () => {
    expect(parseLookupQuery("10.1109/CVPR.2016.90")).toEqual({ doi: "10.1109/cvpr.2016.90" });
    expect(parseLookupQuery("https://doi.org/10.18653/v1/N19-1423")).toEqual({
      doi: "10.18653/v1/n19-1423",
    });
  });

  it("arXiv DOI 는 arXiv ID 로 본다", () => {
    expect(parseLookupQuery("10.48550/arXiv.1706.03762")).toEqual({ arxiv: "1706.03762" });
  });

  it("나머지는 제목으로 찾는다. 빈 입력은 undefined", () => {
    expect(parseLookupQuery("  Attention Is All You Need ")).toEqual({
      title: "Attention Is All You Need",
    });
    expect(parseLookupQuery("   ")).toBeUndefined();
  });
});

describe("parseAuthors / authorsText", () => {
  it("쉼표·줄바꿈으로 나누고 빈 이름은 버린다", () => {
    expect(parseAuthors("Kaiming He,  Xiangyu   Zhang\nJian Sun, ")).toEqual([
      { name: "Kaiming He" },
      { name: "Xiangyu Zhang" },
      { name: "Jian Sun" },
    ]);
    expect(parseAuthors("")).toEqual([]);
  });

  it("세 명을 넘으면 외 n명", () => {
    const a = ["A", "B", "C", "D", "E"].map((name) => ({ name }));
    expect(authorsText(a)).toBe("A, B, C 외 2명");
    expect(authorsText(a.slice(0, 2))).toBe("A, B");
  });
});

describe("manualPatch", () => {
  const now = new Date("2026-10-28");
  const base = {
    title: " Deep  Residual Learning ",
    authors: "Kaiming He",
    year: "2016",
    venue: "CVPR",
  };

  it("값을 정리하고 확인 필요 표시를 지운다", () => {
    expect(manualPatch(base, now)).toEqual({
      title: "Deep Residual Learning",
      normTitle: "deep residual learning",
      authors: [{ name: "Kaiming He" }],
      year: 2016,
      venue: "CVPR",
      needsReview: false,
    });
  });

  it("비운 연도·학회는 필드를 지운다", () => {
    const p = manualPatch({ ...base, year: " ", venue: "" }, now);
    expect(typeof p.year).toBe("object");
    expect(typeof p.venue).toBe("object");
  });

  it("제목이 없거나 연도가 이상하면 막는다", () => {
    expect(() => manualPatch({ ...base, title: "  " }, now)).toThrow("제목");
    expect(() => manualPatch({ ...base, year: "16" }, now)).toThrow("연도");
    expect(() => manualPatch({ ...base, year: "2030" }, now)).toThrow("연도");
    expect(manualPatch({ ...base, year: "2027" }, now).year).toBe(2027);
  });
});

describe("candidatesOf", () => {
  const meta = (title: string): PaperMetadata => ({
    source: "openalex",
    method: "title-search",
    title,
    authors: [],
    kind: "other",
    ids: {},
  });

  it("match 를 맨 앞에 둔다", () => {
    const out: MetadataLookupOutput = {
      status: "found",
      match: meta("A"),
      candidates: [meta("B")],
      tried: [],
    };
    expect(candidatesOf(out).map((c) => c.title)).toEqual(["A", "B"]);
    expect(candidatesOf({ status: "not_found", candidates: [], tried: [] })).toEqual([]);
  });
});
