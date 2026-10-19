import { defineConfig, devices } from "@playwright/test";

// 에뮬레이터는 package.json 의 `firebase emulators:exec` 가 띄운다. 웹 앱은 여기서 띄운다.
// 개발용 5173 과 겹치지 않게 E2E 는 5174 를 쓰고, 이미 떠 있는 다른 서버를 재사용하지 않는다.
const PORT = 5174;
// Auth 에뮬레이터(127.0.0.1:9099)와 같은 사이트여야 팝업 로그인이 동작한다 (브라우저 저장소 분리).
const HOST = "127.0.0.1";
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter @jjok/web exec vite --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_APP_ENV: "dev", VITE_USE_EMULATORS: "true", VITE_DRIVE_BACKEND: "memory" },
    timeout: 60_000,
  },
});
