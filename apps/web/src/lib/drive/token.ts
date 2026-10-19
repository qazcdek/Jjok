// Drive 액세스 토큰 관리. DevDocs/09-open-issues.md I-03
//
// Firebase signInWithPopup 이 주는 Google 액세스 토큰은 약 1시간 뒤 만료되고 Firebase 가 갱신해 주지 않는다.
// 만료되면 Google Identity Services(GIS) 토큰 클라이언트로 재발급한다.
// 주의: GIS 재발급은 팝업을 띄울 수 있으므로 사용자 동작(클릭) 안에서 호출되어야 한다.

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export type InvalidateReason = "expired" | "insufficient_scope";

export interface AccessTokenProvider {
  getToken(): Promise<string>;
  /** insufficient_scope: 다음 발급 때 동의 화면을 다시 띄워 드라이브 권한을 받는다 */
  invalidate(reason?: InvalidateReason): void;
}

const EXPIRY_MARGIN_MS = 60_000;
const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  /** 실제로 허용된 범위 (공백 구분). 세부 동의에서 사용자가 일부를 빼면 요청한 범위보다 적다 */
  scope?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type: string; message?: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

export type TokenPrompt = "" | "consent";
export type TokenRequester = (prompt: TokenPrompt, loginHint?: string) => Promise<TokenResponse>;

export class DriveScopeError extends Error {
  constructor() {
    super(
      "드라이브 권한이 허용되지 않았습니다. 다시 시도하고, 동의 화면에서 드라이브 항목을 체크해 주세요.",
    );
    this.name = "DriveScopeError";
  }
}

export function hasDriveScope(resp: TokenResponse): boolean {
  // scope 를 주지 않는 응답은 요청한 범위가 그대로 허용된 것으로 본다
  return resp.scope === undefined || resp.scope.split(" ").includes(DRIVE_SCOPE);
}

let gisLoading: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Google Identity Services 스크립트를 불러오지 못했습니다."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

export class GoogleTokenProvider implements AccessTokenProvider {
  private token: string | null = null;
  private expiresAt = 0;
  private loginHint: string | undefined;
  private needConsent = false;
  private readonly now: () => number;
  private readonly requester: TokenRequester;

  constructor(
    private readonly clientId: string,
    options: { now?: () => number; requester?: TokenRequester } = {},
  ) {
    this.now = options.now ?? Date.now;
    this.requester = options.requester ?? ((prompt, hint) => this.requestViaGis(prompt, hint));
  }

  /** 로그인 직후 Firebase credential 에서 받은 토큰을 넣는다 */
  set(token: string, expiresInSec: number, loginHint?: string): void {
    this.token = token;
    this.expiresAt = this.now() + expiresInSec * 1000;
    if (loginHint) this.loginHint = loginHint;
  }

  setLoginHint(email: string | undefined): void {
    this.loginHint = email;
  }

  clear(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  invalidate(reason: InvalidateReason = "expired"): void {
    this.clear();
    if (reason === "insufficient_scope") this.needConsent = true;
  }

  async getToken(): Promise<string> {
    if (this.token && this.now() < this.expiresAt - EXPIRY_MARGIN_MS) return this.token;
    // 이미 동의한 사용자는 prompt '' 로 추가 동의 없이 재발급된다.
    // 받은 토큰에 드라이브 범위가 없으면 (세부 동의에서 빠짐, 다른 계정 선택 등) 동의 화면으로 다시 받는다.
    let resp = await this.requester(this.needConsent ? "consent" : "", this.loginHint);
    if (!hasDriveScope(resp)) resp = await this.requester("consent", this.loginHint);
    if (!hasDriveScope(resp)) throw new DriveScopeError();
    this.needConsent = false;
    this.set(resp.access_token, resp.expires_in);
    return resp.access_token;
  }

  private async requestViaGis(prompt: TokenPrompt, loginHint?: string): Promise<TokenResponse> {
    if (!this.clientId) {
      throw new Error("VITE_GOOGLE_OAUTH_CLIENT_ID 가 없어 드라이브 토큰을 갱신할 수 없습니다.");
    }
    await loadGis();
    const oauth2 = window.google!.accounts.oauth2;
    return new Promise((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: (resp) => {
          if (resp.error) reject(new Error(resp.error_description ?? resp.error));
          else resolve(resp);
        },
        error_callback: (err) => reject(new Error(err.message ?? err.type)),
      });
      client.requestAccessToken({ prompt, login_hint: loginHint });
    });
  }
}
