import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initAnalytics } from "./lib/firebase/analytics";
import "./app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void initAnalytics().catch(() => {
  // 통계 수집 실패는 앱 동작에 영향을 주지 않는다
});
