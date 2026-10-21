/* 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen */

/**
 * 내장 도구 metadata-lookup 입력: POST /v1/tools/metadata-lookup. DevDocs/05-agent-server.md §4.5. doi·arxiv·title 중 하나 이상 (서버가 검사)
 */
export interface MetadataLookupInput {
  doi?: string;
  /**
   * 버전 접미사 없이
   */
  arxiv?: string;
  /**
   * 식별자로 못 찾을 때 제목 검색에 쓴다
   */
  title?: string;
}
