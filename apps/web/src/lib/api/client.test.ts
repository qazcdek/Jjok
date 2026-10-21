import { describe, expect, it, vi } from "vitest";

vi.mock("../firebase/app", () => ({ auth: { currentUser: null } }));
const { ApiError, callTool } = await import("./client");

const json = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("callTool", () => {
  it("토큰을 붙여 /v1/tools/{tool} 로 보낸다", async () => {
    const fetchFn = json(200, { status: "found" });
    const out = await callTool("metadata-lookup", { arxiv: "1" }, { fetchFn, idToken: "tok" });
    expect(out).toEqual({ status: "found" });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/v1\/tools\/metadata-lookup$/);
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
    expect(init.body).toBe('{"arxiv":"1"}');
  });

  it("공통 오류 형식을 ApiError 로 바꾼다", async () => {
    const fetchFn = json(429, { error: { code: "upstream_rate_limited", message: "한도" } });
    await expect(callTool("x", {}, { fetchFn, idToken: "t" })).rejects.toMatchObject({
      status: 429,
      code: "upstream_rate_limited",
      message: "한도",
    });
  });

  it("로그인하지 않았으면 보내지 않는다", async () => {
    const fetchFn = vi.fn();
    await expect(callTool("x", {}, { fetchFn })).rejects.toBeInstanceOf(ApiError);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("연결 실패는 network_error", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(callTool("x", {}, { fetchFn, idToken: "t" })).rejects.toMatchObject({
      code: "network_error",
    });
  });
});
