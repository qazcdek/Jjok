import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/firebase/app", () => ({ db: {} }));
vi.mock("../../lib/drive", () => ({ drive: {}, warmDriveToken: async () => {} }));

const { isPdf, statusLabel } = await import("./uploadQueue");

describe("isPdf", () => {
  it("MIME 타입이나 확장자로 PDF 를 알아본다", () => {
    expect(isPdf({ name: "a.pdf", type: "application/pdf" })).toBe(true);
    expect(isPdf({ name: "A.PDF", type: "" })).toBe(true);
    expect(isPdf({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(isPdf({ name: "figure.png", type: "image/png" })).toBe(false);
  });
});

describe("statusLabel", () => {
  it("중복이면 기존 논문 제목을 보여 준다", () => {
    expect(statusLabel({ kind: "duplicate", workId: "w1", title: "Attention" })).toBe(
      "이미 있음: Attention",
    );
  });
});
