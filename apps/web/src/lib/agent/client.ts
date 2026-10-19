// 에이전트 서버 클라이언트. 인증: Firebase ID 토큰 (DevDocs/04-security.md §1)
import { env } from "../env";
import { auth } from "../firebase/app";

export class AgentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

type Fetch = typeof fetch;

export async function callTool<T>(
  name: string,
  payload: unknown,
  fetchFn: Fetch = (...args) => fetch(...args),
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new AgentError(401, "unauthenticated", "로그인이 필요합니다.");
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetchFn(`${env.agentBaseUrl}/v1/tools/${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // 서버가 꺼져 있거나 CORS 거부
    throw new AgentError(
      0,
      "agent_unreachable",
      `에이전트 서버에 연결할 수 없습니다: ${String(e)}`,
      true,
    );
  }
  if (res.ok) return (await res.json()) as T;
  const body = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string; details?: { retryable?: boolean } };
  };
  throw new AgentError(
    res.status,
    body.error?.code ?? "http_error",
    body.error?.message ?? `HTTP ${res.status}`,
    Boolean(body.error?.details?.retryable),
  );
}
