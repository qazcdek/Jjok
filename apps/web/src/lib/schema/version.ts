/* 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen */
import type { Timestamp } from "firebase/firestore";

/**
 * users/{uid}/works/{workId}/versions/{versionId}. DevDocs/03-data-model.md §3.3
 */
export interface VersionDoc {
  schemaVersion: number;
  kind: "preprint" | "workshop" | "conference" | "journal" | "other";
  label: string;
  ids: {
    doi?: string;
    arxiv?: string;
    arxivVersion?: number;
    openreview?: string;
  };
  venue?: string;
  year?: number;
  driveFileId?: string;
  /**
   * SHA-256 hex
   */
  fileHash?: string;
  fileName?: string;
  fileSize?: number;
  format: "pdf" | "markdown";
  pageCount?: number;
  metadataSource: "identifier" | "title-search" | "manual" | "agent";
  /**
   * Firestore Timestamp (TS: firebase Timestamp, Python: datetime)
   */
  createdAt: Timestamp;
  /**
   * Firestore Timestamp (TS: firebase Timestamp, Python: datetime)
   */
  updatedAt: Timestamp;
}
