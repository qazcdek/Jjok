import { describe, expect, it, vi } from "vitest";

vi.mock("./app", () => ({ firebaseApp: {} }));
vi.mock("../env", () => ({ env: { useEmulators: true, firebase: {} } }));

const { isAnalyticsAvailable, isAnalyticsOptedOut } = await import("./analytics");

describe("analytics", () => {
  it("에뮬레이터 모드에서는 쓰지 않는다", () => {
    expect(isAnalyticsAvailable()).toBe(false);
  });

  it("저장된 값이 off 일 때만 수집 거부로 본다", () => {
    expect(isAnalyticsOptedOut({ getItem: () => "off" })).toBe(true);
    expect(isAnalyticsOptedOut({ getItem: () => null })).toBe(false);
  });

  it("저장소 접근이 실패하면 거부하지 않은 것으로 본다", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(isAnalyticsOptedOut(throwing)).toBe(false);
  });
});
