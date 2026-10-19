// 업로드한 PDF 의 메타데이터를 정한다 (F-1.2, M1-03 + M1-04).
// 1) PDF 앞부분 추출 → 2) 서버 metadata-lookup 조회 → 3) Work/Version 값 결정.
// 서버가 꺼져 있거나 조회가 불확실하면 추출 결과로 채우고 needsReview 로 표시한다.
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AgentError, callTool } from "../../lib/agent/client";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { extractFromPdf, type PdfExtraction } from "./pdfExtract";

/** tools/metadata-lookup 의 출력 모델 */
export interface LookupMetadata {
  title: string;
  authors: { name: string; family?: string | null; given?: string | null }[];
  year?: number | null;
  venue?: string | null;
  kind: VersionDoc["kind"];
  abstract?: string | null;
  ids: Partial<Record<keyof WorkDoc["ids"] | "arxivVersion", string | number | null>>;
  source: string;
}

export interface LookupOutput {
  status: "found" | "ambiguous" | "not_found";
  metadata?: LookupMetadata | null;
  candidates: LookupMetadata[];
  warnings: string[];
}

export interface ResolvedWork {
  title: string;
  authors: WorkDoc["authors"];
  year?: number;
  venue?: string;
  abstract?: string;
  ids: WorkDoc["ids"];
}

export interface ResolvedVersion {
  kind: VersionDoc["kind"];
  label: string;
  ids: VersionDoc["ids"];
  venue?: string;
  year?: number;
  pageCount?: number;
}

export interface Resolved {
  work: ResolvedWork;
  version: ResolvedVersion;
  metadataSource: VersionDoc["metadataSource"];
  needsReview: boolean;
  candidates: LookupMetadata[];
  warnings: string[];
}

export interface ResolveDeps {
  loadPdf: (file: Blob) => Promise<PDFDocumentProxy>;
  lookup: (input: object) => Promise<LookupOutput>;
}

const defaultDeps = (): ResolveDeps => ({
  loadPdf: async (file) => (await import("./pdfjs")).loadPdf(file),
  lookup: (input) => callTool<LookupOutput>("metadata-lookup", input),
});

const EMPTY: PdfExtraction = { titleCandidates: [], pageCount: 0 };

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function compact<T extends object>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null),
  ) as T;
}

function fileTitle(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, "")
      .replace(/[_]+/g, " ")
      .trim() || "제목 없음"
  );
}

export async function resolveFromPdf(
  file: File,
  deps: ResolveDeps = defaultDeps(),
): Promise<Resolved> {
  const warnings: string[] = [];
  let ex = EMPTY;
  try {
    ex = await extractFromPdf(await deps.loadPdf(file));
  } catch (e) {
    warnings.push(`PDF 를 읽지 못했습니다: ${String(e)}`);
  }

  const title = ex.titleCandidates[0];
  const input = compact({ doi: ex.doi, arxiv: ex.arxiv?.id, title });
  let out: LookupOutput | null = null;
  if (input.doi || input.arxiv || input.title) {
    try {
      out = await deps.lookup(input);
      warnings.push(...out.warnings);
    } catch (e) {
      warnings.push(e instanceof AgentError ? e.message : String(e));
    }
  }
  const m = out?.status === "found" ? (out.metadata ?? null) : null;

  // 이 PDF 자체가 어떤 판인가: arXiv 표기가 있으면 프리프린트, 아니면 조회·문구 단서를 따른다
  const isArxivPdf = Boolean(ex.arxiv);
  const kind: VersionDoc["kind"] = isArxivPdf
    ? "preprint"
    : (m?.kind ?? ex.venueHint?.kind ?? "other");
  const publishedVenue =
    (m?.venue && m.venue !== "arXiv" ? m.venue : undefined) ?? ex.venueHint?.venue;
  const year = m?.year ?? ex.venueHint?.year;

  const work: ResolvedWork = compact({
    title: m?.title ?? title ?? fileTitle(file.name),
    authors: (m?.authors ?? []).map((a) =>
      compact({ name: a.name, family: a.family ?? undefined, given: a.given ?? undefined }),
    ),
    year: year ?? undefined,
    venue: publishedVenue,
    abstract: m?.abstract ?? undefined,
    ids: compact({
      doi: str(m?.ids.doi) ?? ex.doi,
      arxiv: str(m?.ids.arxiv) ?? ex.arxiv?.id,
      openreview: str(m?.ids.openreview) ?? ex.openreview,
      s2: str(m?.ids.s2),
      openalex: str(m?.ids.openalex),
      dblp: str(m?.ids.dblp),
    }),
  });

  const arxivVersion =
    ex.arxiv?.version ?? (isArxivPdf ? Number(m?.ids.arxivVersion) || undefined : undefined);
  const versionVenue = isArxivPdf ? "arXiv" : publishedVenue;
  const version: ResolvedVersion = compact({
    kind,
    label: isArxivPdf
      ? `arXiv${arxivVersion ? ` v${arxivVersion}` : ""}`
      : [versionVenue, year].filter(Boolean).join(" ") || "업로드",
    ids: compact(
      isArxivPdf
        ? { arxiv: ex.arxiv?.id, arxivVersion }
        : { doi: work.ids.doi, openreview: work.ids.openreview },
    ),
    venue: versionVenue,
    year: isArxivPdf ? (m?.year ?? undefined) : year,
    pageCount: ex.pageCount || undefined,
  });

  const metadataSource: VersionDoc["metadataSource"] = !m
    ? "manual"
    : ex.doi || ex.arxiv
      ? "identifier"
      : "title-search";

  return {
    work,
    version,
    metadataSource,
    needsReview: !m,
    candidates: out?.status === "ambiguous" ? out.candidates : [],
    warnings,
  };
}
