import { describe, expect, it, vi } from "vitest";
import { escapeQuery, GoogleDriveClient, MULTIPART_LIMIT } from "./googleDrive";
import type { AccessTokenProvider } from "./token";

type Call = { url: string; init: RequestInit };

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function setup(responses: Array<(call: Call) => Response>) {
  const calls: Call[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const next = responses.shift();
    if (!next) throw new Error(`예상하지 못한 요청: ${call.url}`);
    return next(call);
  });
  let n = 0;
  const tokens: AccessTokenProvider & { invalidated: number; reasons: string[] } = {
    invalidated: 0,
    reasons: [],
    getToken: async () => `token-${++n}`,
    invalidate(reason = "expired") {
      this.invalidated += 1;
      this.reasons.push(reason);
    },
  };
  const client = new GoogleDriveClient(tokens, fetchFn as unknown as typeof fetch);
  return { client, calls, tokens };
}

const auth = (c: Call) => new Headers(c.init.headers).get("Authorization");
const q = (c: Call) => new URL(c.url).searchParams.get("q");

describe("escapeQuery", () => {
  it("작은따옴표와 역슬래시를 이스케이프한다", () => {
    expect(escapeQuery("it's a\\b")).toBe("it\\'s a\\\\b");
  });
});

describe("ensureAppFolders", () => {
  it("폴더가 없으면 /Jjok, /Jjok/files 를 차례로 만든다", async () => {
    const { client, calls } = setup([
      () => json({ files: [] }),
      () => json({ id: "root1" }),
      () => json({ files: [] }),
      () => json({ id: "files1" }),
    ]);
    await expect(client.ensureAppFolders()).resolves.toEqual({
      rootFolderId: "root1",
      filesFolderId: "files1",
    });
    expect(q(calls[0]!)).toContain("name = 'Jjok'");
    expect(q(calls[0]!)).toContain("'root' in parents");
    expect(JSON.parse(String(calls[1]!.init.body))).toMatchObject({
      name: "Jjok",
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    });
    expect(q(calls[2]!)).toContain("'root1' in parents");
  });

  it("캐시된 폴더가 살아 있으면 새로 만들지 않는다", async () => {
    const { client, calls } = setup([
      () => json({ id: "r", trashed: false }),
      () => json({ id: "f", trashed: false }),
    ]);
    await expect(
      client.ensureAppFolders({ rootFolderId: "r", filesFolderId: "f" }),
    ).resolves.toEqual({ rootFolderId: "r", filesFolderId: "f" });
    expect(calls).toHaveLength(2);
  });

  it("캐시된 폴더가 휴지통에 있으면 다시 찾거나 만든다", async () => {
    const { client } = setup([
      () => json({ id: "r", trashed: true }),
      () => json({ files: [{ id: "r2" }] }),
      () => new Response("not found", { status: 404 }),
      () => json({ files: [] }),
      () => json({ id: "f2" }),
    ]);
    await expect(
      client.ensureAppFolders({ rootFolderId: "r", filesFolderId: "f" }),
    ).resolves.toEqual({ rootFolderId: "r2", filesFolderId: "f2" });
  });
});

describe("uploadPdf", () => {
  const folders = { rootFolderId: "r", filesFolderId: "f" };

  it("작은 파일은 workId 폴더 안에 <versionId>.pdf 로 multipart 업로드한다", async () => {
    const { client, calls } = setup([
      () => json({ files: [{ id: "workFolder" }] }),
      () => json({ id: "file1" }),
    ]);
    const file = new Blob(["%PDF-1.7 test"], { type: "application/pdf" });
    await expect(
      client.uploadPdf({ folders, workId: "w1", versionId: "v1", file }),
    ).resolves.toEqual({ fileId: "file1" });
    expect(q(calls[0]!)).toContain("name = 'w1'");
    const upload = calls[1]!;
    expect(upload.url).toContain("uploadType=multipart");
    const contentType = new Headers(upload.init.headers).get("Content-Type")!;
    expect(contentType).toMatch(/^multipart\/related; boundary=/);
    const body = await (upload.init.body as Blob).text();
    expect(body).toContain('"name":"v1.pdf"');
    expect(body).toContain('"parents":["workFolder"]');
    expect(body).toContain("%PDF-1.7 test");
  });

  it("큰 파일은 resumable 세션을 열고 PUT 으로 보낸다", async () => {
    const { client, calls } = setup([
      () => json({ files: [{ id: "workFolder" }] }),
      () =>
        new Response(null, {
          status: 200,
          headers: { Location: "https://upload.example/session" },
        }),
      () => json({ id: "bigfile" }),
    ]);
    const file = new Blob([new Uint8Array(MULTIPART_LIMIT + 1)], { type: "application/pdf" });
    await expect(
      client.uploadPdf({ folders, workId: "w1", versionId: "v1", file }),
    ).resolves.toEqual({ fileId: "bigfile" });
    expect(calls[1]!.url).toContain("uploadType=resumable");
    expect(new Headers(calls[1]!.init.headers).get("X-Upload-Content-Length")).toBe(
      String(MULTIPART_LIMIT + 1),
    );
    expect(calls[2]!.url).toBe("https://upload.example/session");
    expect(calls[2]!.init.method).toBe("PUT");
  });
});

describe("인증", () => {
  it("401 이면 토큰을 버리고 새 토큰으로 한 번 재시도한다", async () => {
    const { client, calls, tokens } = setup([
      () => new Response("expired", { status: 401 }),
      () => new Response("pdf-bytes"),
    ]);
    const blob = await client.download("file1");
    expect(await blob.text()).toBe("pdf-bytes");
    expect(tokens.invalidated).toBe(1);
    expect(auth(calls[0]!)).toBe("Bearer token-1");
    expect(auth(calls[1]!)).toBe("Bearer token-2");
  });

  it("재시도 후에도 401 이면 DriveError 를 던진다", async () => {
    const { client } = setup([
      () => new Response("expired", { status: 401 }),
      () => new Response("still expired", { status: 401 }),
    ]);
    await expect(client.download("file1")).rejects.toMatchObject({
      name: "DriveError",
      status: 401,
    });
  });

  it("403 범위 부족이면 insufficient_scope 로 무효화하고 한 번 재시도한다", async () => {
    const scopeError = JSON.stringify({
      error: { code: 403, details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] },
    });
    const { client, tokens } = setup([
      () => new Response(scopeError, { status: 403 }),
      () => new Response("pdf-bytes"),
    ]);
    expect(await (await client.download("file1")).text()).toBe("pdf-bytes");
    expect(tokens.reasons).toEqual(["insufficient_scope"]);
  });

  it("다른 403 은 재시도하지 않는다", async () => {
    const { client, tokens } = setup([() => new Response("rate limit", { status: 403 })]);
    await expect(client.download("file1")).rejects.toMatchObject({ status: 403 });
    expect(tokens.invalidated).toBe(0);
  });
});
