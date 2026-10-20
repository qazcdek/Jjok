/* 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen */

/**
 * 내장 도구 metadata-lookup 출력. DevDocs/05-agent-server.md §4.5
 */
export interface MetadataLookupOutput {
  /**
   * found: match 를 그대로 써도 된다. ambiguous: 제목 검색 후보만 있다 (사용자 확인, M1-05). not_found: 후보 없음
   */
  status: "found" | "ambiguous" | "not_found";
  match?: PaperMetadata;
  /**
   * 제목 검색 후보 (점수 순). found 일 때도 다른 후보를 함께 준다
   */
  candidates: PaperMetadata[];
  /**
   * 조회한 곳과 결과. 오류 원인 표시·디버깅용
   */
  tried: {
    source: "arxiv" | "crossref" | "openalex" | "s2";
    outcome: "found" | "not_found" | "rate_limited" | "error";
  }[];
}
export interface PaperMetadata {
  source: "arxiv" | "crossref" | "openalex" | "s2";
  method: "identifier" | "title-search";
  title: string;
  authors: {
    name: string;
    family?: string;
    given?: string;
  }[];
  year?: number;
  /**
   * 학회·저널 이름 (출처 표기 그대로)
   */
  venue?: string;
  abstract?: string;
  /**
   * 이 메타데이터가 가리키는 버전의 종류
   */
  kind: "preprint" | "workshop" | "conference" | "journal" | "other";
  ids: ExternalIds;
  /**
   * arXiv 최신 버전 번호
   */
  arxivVersion?: number;
  /**
   * 제목 검색일 때 입력 제목과의 유사도
   */
  score?: number;
}
export interface ExternalIds {
  doi?: string;
  /**
   * 버전 접미사 제거 (예: 2401.01234)
   */
  arxiv?: string;
  openreview?: string;
  s2?: string;
  openalex?: string;
  dblp?: string;
}
