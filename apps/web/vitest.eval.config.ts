import { defineConfig } from "vitest/config";

// 평가 스크립트 전용 (일반 테스트와 분리). 사용: PDF_DIR=<폴더> pnpm eval:metadata
export default defineConfig({
  test: { include: ["eval/**/*.eval.ts"], testTimeout: 120_000 },
});
