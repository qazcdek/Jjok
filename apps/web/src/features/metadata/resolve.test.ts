import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfExtraction } from "./pdfExtract";

vi.mock("../../lib/firebase/app", () => ({ auth: {}, db: {} }));
let extraction: PdfExtraction;
vi.mock("./pdfExtract", () => ({ extractFromPdf: async () => extraction }));

const { resolveFromPdf } = await import("./resolve");
const { AgentError } = await import("../../lib/agent/client");
type LookupOutput = import("./resolve").LookupOutput;

const file = new File(["%PDF"], "my_paper.pdf");
const deps = (lookup: (input: object) => Promise<LookupOutput>) => ({
  loadPdf: async () => ({}) as never,
  lookup,
});

const attention = {
  title: "Attention Is All You Need",
  authors: [{ name: "Ashish Vaswani", family: "Vaswani", given: "Ashish" }],
  year: 2017,
  venue: "arXiv",
  kind: "preprint" as const,
  ids: { arxiv: "1706.03762", arxivVersion: 7 },
  source: "arxiv",
};

beforeEach(() => {
  extraction = { titleCandidates: [], pageCount: 0 };
});

describe("resolveFromPdf", () => {
  it("arXiv PDF: 프리프린트 판으로, venue 단서는 작품 venue 로", async () => {
    extraction = {
      arxiv: { id: "1706.03762", version: 7 },
      titleCandidates: ["Attention Is All You Need"],
      venueHint: { venue: "NeurIPS", year: 2017, kind: "conference" },
      pageCount: 15,
    };
    const lookup = vi.fn(async () => ({
      status: "found" as const,
      metadata: attention,
      candidates: [],
      warnings: [],
    }));
    const r = await resolveFromPdf(file, deps(lookup));
    expect(lookup).toHaveBeenCalledWith({
      arxiv: "1706.03762",
      title: "Attention Is All You Need",
    });
    expect(r.work).toMatchObject({
      title: "Attention Is All You Need",
      year: 2017,
      venue: "NeurIPS",
    });
    expect(r.work.ids).toEqual({ arxiv: "1706.03762" });
    expect(r.version).toEqual({
      kind: "preprint",
      label: "arXiv v7",
      ids: { arxiv: "1706.03762", arxivVersion: 7 },
      venue: "arXiv",
      year: 2017,
      pageCount: 15,
    });
    expect(r.metadataSource).toBe("identifier");
    expect(r.needsReview).toBe(false);
  });

  it("식별자 없는 학회판: 제목 검색 결과의 학회 정보로 판을 정한다", async () => {
    extraction = {
      titleCandidates: ["Deep Residual Learning for Image Recognition"],
      pageCount: 9,
    };
    const r = await resolveFromPdf(
      file,
      deps(async () => ({
        status: "found",
        metadata: {
          title: "Deep Residual Learning for Image Recognition",
          authors: [{ name: "Kaiming He", family: "He" }],
          year: 2016,
          venue: "CVPR",
          kind: "conference",
          ids: { doi: "10.1109/cvpr.2016.90", arxiv: "1512.03385", openalex: "W1" },
          source: "openalex",
        },
        candidates: [],
        warnings: [],
      })),
    );
    expect(r.version).toMatchObject({
      kind: "conference",
      label: "CVPR 2016",
      ids: { doi: "10.1109/cvpr.2016.90" },
    });
    expect(r.work.ids).toEqual({
      doi: "10.1109/cvpr.2016.90",
      arxiv: "1512.03385",
      openalex: "W1",
    });
    expect(r.metadataSource).toBe("title-search");
  });

  it("서버에 연결할 수 없으면 추출한 제목으로 저장하고 확인 필요로 표시", async () => {
    extraction = { titleCandidates: ["Some Title From PDF"], pageCount: 3 };
    const r = await resolveFromPdf(
      file,
      deps(async () => {
        throw new AgentError(0, "agent_unreachable", "에이전트 서버에 연결할 수 없습니다", true);
      }),
    );
    expect(r.work.title).toBe("Some Title From PDF");
    expect(r.needsReview).toBe(true);
    expect(r.metadataSource).toBe("manual");
    expect(r.warnings[0]).toContain("에이전트 서버");
  });

  it("후보가 애매하면 후보를 돌려주고 확인 필요", async () => {
    extraction = { titleCandidates: ["Ambiguous Title"], pageCount: 1 };
    const r = await resolveFromPdf(
      file,
      deps(async () => ({ status: "ambiguous", candidates: [attention], warnings: [] })),
    );
    expect(r.needsReview).toBe(true);
    expect(r.candidates).toHaveLength(1);
  });

  it("아무 단서도 없으면 조회하지 않고 파일 이름을 제목으로", async () => {
    const lookup = vi.fn();
    const r = await resolveFromPdf(file, deps(lookup));
    expect(lookup).not.toHaveBeenCalled();
    expect(r.work.title).toBe("my paper");
    expect(r.version.label).toBe("업로드");
  });
});
