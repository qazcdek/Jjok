/* 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen */
import type { Timestamp } from "firebase/firestore";

/**
 * users/{uid}/works/{workId}. DevDocs/03-data-model.md §3.2
 */
export interface WorkDoc {
  schemaVersion: number;
  title: string;
  normTitle: string;
  authors: {
    name: string;
    family?: string;
    given?: string;
    s2AuthorId?: string;
  }[];
  year?: number;
  venue?: string;
  primaryVersionId: string;
  ids: ExternalIds;
  citeKey: string;
  collectionIds: string[];
  tagIds: string[];
  abstract?: string;
  /**
   * 모든 버전 PDF 의 SHA-256. 업로드 전 중복 검사용 (array-contains 쿼리, F-2.3)
   */
  fileHashes?: string[];
  /**
   * Firestore Timestamp (TS: firebase Timestamp, Python: datetime)
   */
  createdAt: Timestamp;
  /**
   * Firestore Timestamp (TS: firebase Timestamp, Python: datetime)
   */
  updatedAt: Timestamp;
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
