import { describe, expect, it, vi } from "vitest";

// Firebase 초기화 없이 순수 함수만 테스트한다
vi.mock("../../lib/firebase/app", () => ({ db: {} }));
vi.mock("../../lib/drive", () => ({ drive: {} }));

const { normalizeTitle } = await import("./uploads");

describe("normalizeTitle", () => {
  it("소문자화하고 기호와 공백을 정리한다", () => {
    expect(normalizeTitle("  Attention Is All You Need!! (v2) ")).toBe(
      "attention is all you need v2",
    );
  });

  it("한글과 전각 문자를 보존·정규화한다", () => {
    expect(normalizeTitle("트랜스포머：개요")).toBe("트랜스포머 개요");
  });
});
