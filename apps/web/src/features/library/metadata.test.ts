import { describe, expect, it, vi } from "vitest";
import type { PaperMetadata, VersionDoc } from "../../lib/schema";

// metadata.ts 가 불러오는 Firebase 초기화를 막는다 (순수 함수만 시험)
vi.mock("../../lib/firebase/app", () => ({ db: {}, auth: {} }));
const { fillIds, lookupInput, metadataPatch } = await import("./metadata");

const arxivMeta: PaperMetadata = {
  source: "arxiv",
  method: "identifier",
  title: "Attention Is All You Need",
  authors: [{ name: "Ashish Vaswani", given: "Ashish", family: "Vaswani" }],
  year: 2017,
  kind: "preprint",
  ids: { arxiv: "1706.03762", doi: "10.5555/published" },
  arxivVersion: 7,
};

const crossrefMeta: PaperMetadata = {
  source: "crossref",
  method: "identifier",
  title: "Deep Residual Learning for Image Recognition",
  authors: [{ name: "Kaiming He" }],
  year: 2016,
  venue: "CVPR",
  kind: "conference",
  ids: { doi: "10.1109/cvpr.2016.90" },
};

type V = Pick<VersionDoc, "kind" | "ids" | "venue" | "year" | "label">;
const uploaded: V = { kind: "other", ids: {}, label: "업로드" };
const arxivVersion: V = {
  kind: "preprint",
  ids: { arxiv: "1706.03762", arxivVersion: 3 },
  label: "arXiv v3",
};

describe("lookupInput", () => {
  it("DOI·arXiv·첫 제목 후보를 넣는다", () => {
    expect(
      lookupInput({ doi: "10.1/x", arxiv: "1", titleCandidates: ["T", "U"], pageCount: 1 }),
    ).toEqual({ doi: "10.1/x", arxiv: "1", title: "T" });
  });
  it("단서가 없으면 조회하지 않는다", () => {
    expect(lookupInput(undefined)).toBeUndefined();
    expect(lookupInput({ titleCandidates: [], pageCount: 1 })).toBeUndefined();
  });
});

describe("fillIds", () => {
  it("비어 있는 식별자만 채운다", () => {
    expect(fillIds({ doi: "a" }, { doi: "b", s2: "c" })).toEqual({ doi: "a", s2: "c" });
  });
});

describe("metadataPatch", () => {
  it("새 논문 + arXiv: 논문 정보를 채우고, 출판본 DOI 는 논문에만 둔다. PDF 의 arXiv 버전은 그대로", () => {
    const patch = metadataPatch(arxivMeta, { ids: { arxiv: "1706.03762" } }, arxivVersion, {
      newWork: true,
    });
    expect(patch.work).toEqual({
      ids: { arxiv: "1706.03762", doi: "10.5555/published" },
      title: "Attention Is All You Need",
      normTitle: "attention is all you need",
      authors: [{ name: "Ashish Vaswani", given: "Ashish", family: "Vaswani" }],
      year: 2017,
    });
    expect(patch.version).toEqual({
      metadataSource: "identifier",
      ids: { arxiv: "1706.03762", arxivVersion: 3 },
      kind: "preprint",
      year: 2017,
    });
  });

  it("DOI 로 찾은 학회 논문: 버전 종류·학회·연도와 이름을 정한다", () => {
    const patch = metadataPatch(crossrefMeta, { ids: {} }, uploaded, { newWork: true });
    expect(patch.version).toMatchObject({
      kind: "conference",
      venue: "CVPR",
      year: 2016,
      label: "CVPR 2016",
      ids: { doi: "10.1109/cvpr.2016.90" },
    });
    expect(patch.work).toMatchObject({ venue: "CVPR", year: 2016 });
  });

  it("기존 논문에 추가한 버전이면 논문 제목·저자는 건드리지 않는다", () => {
    const patch = metadataPatch(crossrefMeta, { ids: { arxiv: "1512.03385" } }, uploaded, {
      newWork: false,
    });
    expect(patch.work).toEqual({ ids: { arxiv: "1512.03385", doi: "10.1109/cvpr.2016.90" } });
  });

  it("제목 검색 결과는 버전 종류·학회를 바꾸지 않는다 (다른 버전일 수 있음)", () => {
    const patch = metadataPatch(
      { ...crossrefMeta, source: "openalex", method: "title-search", score: 0.95 },
      { ids: {} },
      uploaded,
      { newWork: true },
    );
    expect(patch.version).toEqual({ metadataSource: "title-search", ids: {} });
    expect(patch.work.title).toBe("Deep Residual Learning for Image Recognition");
  });

  it("사용자가 바꾼 버전 이름은 유지한다", () => {
    const patch = metadataPatch(
      crossrefMeta,
      { ids: {} },
      { ...uploaded, label: "내 사본" },
      {
        newWork: true,
      },
    );
    expect(patch.version.label).toBeUndefined();
  });
});
