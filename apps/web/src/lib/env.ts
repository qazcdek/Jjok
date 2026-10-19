// 환경 설정. DevDocs/07-dev-environment.md §4
// VITE_APP_ENV 는 UI 노출만 제어한다. 보안 판단(예: llama 허용)은 서버가 한다.

export type AppEnv = "dev" | "prod";
export type DriveBackend = "memory" | "google";

const raw = import.meta.env;

const useEmulators = raw.VITE_USE_EMULATORS === "true";

// 에뮬레이터 전용 demo 프로젝트: 실제 클라우드 리소스에 접근하지 않는다
const DEMO_FIREBASE = {
  apiKey: "demo-api-key",
  authDomain: "demo-jjok.firebaseapp.com",
  projectId: "demo-jjok",
  appId: "demo-app-id",
};

export const env = {
  appEnv: (raw.VITE_APP_ENV ?? "dev") as AppEnv,
  useEmulators,
  driveBackend: (raw.VITE_DRIVE_BACKEND ?? (useEmulators ? "memory" : "google")) as DriveBackend,
  firebase: useEmulators
    ? DEMO_FIREBASE
    : {
        apiKey: raw.VITE_FIREBASE_API_KEY ?? "",
        authDomain: raw.VITE_FIREBASE_AUTH_DOMAIN ?? "",
        projectId: raw.VITE_FIREBASE_PROJECT_ID ?? "",
        appId: raw.VITE_FIREBASE_APP_ID ?? "",
      },
  googleOAuthClientId: raw.VITE_GOOGLE_OAUTH_CLIENT_ID ?? "",
  agentBaseUrl: raw.VITE_AGENT_BASE_URL ?? "http://localhost:8000",
};

export const EMULATOR_HOSTS = {
  auth: "http://127.0.0.1:9099",
  firestore: { host: "127.0.0.1", port: 8085 },
};
