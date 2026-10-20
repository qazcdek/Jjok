// 백엔드 서버 호출. Firebase ID 토큰을 붙이고 공통 오류 형식을 ApiError 로 바꾼다 (DevDocs/05-agent-server.md §1)
import { auth } from "../firebase/app";
import { env } from "../env";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Fetch = typeof fetch;

export async function postJson<T>(
  path: string,
  body: unknown,
  { fetchFn = fetch, idToken }: { fetchFn?: Fetch; idToken?: string } = {},
): Promise<T> {
  const token = idToken ?? (await auth.currentUser?.getIdToken());
  if (!token) throw new ApiError(401, "unauthenticated", "로그인이 필요합니다.");
  let res: Response;
  try {
    res = await fetchFn(`${env.apiBaseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(0, "network_error", `백엔드 서버에 연결하지 못했습니다: ${String(e)}`);
  }
  const data: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new ApiError(res.status, error?.code ?? "http_error", error?.message ?? res.statusText);
  }
  return data as T;
}

/** 결정적 도구 직접 실행: POST /v1/tools/{tool} */
export function callTool<I, O>(tool: string, input: I, options?: Parameters<typeof postJson>[2]) {
  return postJson<O>(`/v1/tools/${encodeURIComponent(tool)}`, input, options);
}
