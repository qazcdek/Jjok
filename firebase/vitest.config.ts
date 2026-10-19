import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // 에뮬레이터 하나를 공유하므로 파일 간 병렬 실행을 끈다
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
