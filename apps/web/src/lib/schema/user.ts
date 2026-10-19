/* 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen */
import type { Timestamp } from "firebase/firestore";

/**
 * users/{uid}. DevDocs/03-data-model.md §3.1
 */
export interface UserDoc {
  schemaVersion: number;
  displayName: string;
  email: string;
  photoURL?: string | null;
  settings: {
    theme: "light" | "dark" | "system";
    citationStyle: "apa" | "ieee" | "acm" | "chicago" | "bibtex";
    venueFilter: string[];
    llmDefault?: {
      provider: "gemini" | "openai" | "anthropic" | "llama";
      model: string;
    };
  };
  drive?: {
    /**
     * /Jjok 폴더 ID
     */
    rootFolderId?: string;
    /**
     * /Jjok/files 폴더 ID
     */
    filesFolderId?: string;
  };
  /**
   * Firestore Timestamp (TS: firebase Timestamp, Python: datetime)
   */
  createdAt: Timestamp;
  /**
   * Firestore Timestamp (TS: firebase Timestamp, Python: datetime)
   */
  updatedAt: Timestamp;
}
