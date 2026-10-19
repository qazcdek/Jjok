import { describe, expect, it } from "vitest";
import {
  DRIVE_SCOPE,
  DriveScopeError,
  GoogleTokenProvider,
  type TokenPrompt,
  type TokenResponse,
} from "./token";

const WITH_DRIVE = `openid email ${DRIVE_SCOPE}`;

function provider(responses: TokenResponse[], now = () => 0) {
  const prompts: TokenPrompt[] = [];
  const p = new GoogleTokenProvider("client-id", {
    now,
    requester: async (prompt) => {
      prompts.push(prompt);
      const next = responses.shift();
      if (!next) throw new Error("예상하지 못한 토큰 요청");
      return next;
    },
  });
  return { p, prompts };
}

describe("GoogleTokenProvider", () => {
  it("로그인 때 받은 토큰이 유효하면 재발급하지 않는다", async () => {
    const { p, prompts } = provider([]);
    p.set("firebase-token", 3600);
    await expect(p.getToken()).resolves.toBe("firebase-token");
    expect(prompts).toEqual([]);
  });

  it("토큰이 없으면 동의 화면 없이(prompt '') 재발급한다", async () => {
    const { p, prompts } = provider([{ access_token: "t1", expires_in: 3600, scope: WITH_DRIVE }]);
    await expect(p.getToken()).resolves.toBe("t1");
    expect(prompts).toEqual([""]);
  });

  it("재발급 토큰에 drive.file 이 없으면 동의 화면으로 다시 받는다", async () => {
    const { p, prompts } = provider([
      { access_token: "no-drive", expires_in: 3600, scope: "openid email" },
      { access_token: "t2", expires_in: 3600, scope: WITH_DRIVE },
    ]);
    await expect(p.getToken()).resolves.toBe("t2");
    expect(prompts).toEqual(["", "consent"]);
  });

  it("동의 화면에서도 드라이브를 허용하지 않으면 DriveScopeError", async () => {
    const { p } = provider([
      { access_token: "a", expires_in: 3600, scope: "openid" },
      { access_token: "b", expires_in: 3600, scope: "openid" },
    ]);
    await expect(p.getToken()).rejects.toBeInstanceOf(DriveScopeError);
  });

  it("insufficient_scope 로 무효화하면 다음 발급은 동의 화면으로 시작한다", async () => {
    const { p, prompts } = provider([{ access_token: "t3", expires_in: 3600, scope: WITH_DRIVE }]);
    p.set("bad-scope-token", 3600);
    p.invalidate("insufficient_scope");
    await expect(p.getToken()).resolves.toBe("t3");
    expect(prompts).toEqual(["consent"]);
  });

  it("만료 1분 전부터는 재발급한다", async () => {
    let t = 0;
    const { p, prompts } = provider(
      [{ access_token: "fresh", expires_in: 3600, scope: WITH_DRIVE }],
      () => t,
    );
    p.set("old", 3600);
    t = 3600_000 - 59_000;
    await expect(p.getToken()).resolves.toBe("fresh");
    expect(prompts).toEqual([""]);
  });
});
