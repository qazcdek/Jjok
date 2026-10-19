import { useState } from "react";
import { env } from "../lib/env";
import {
  isAnalyticsAvailable,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "../lib/firebase/analytics";
import { StorageCheck } from "../features/m0/StorageCheck";
import { useTheme, type Theme } from "./theme";

export function App() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="shell">
      <header className="topbar">
        <h1>Jjok</h1>
        <span className={`env ${env.appEnv}`}>
          {env.appEnv}
          {env.useEmulators && " · emulator"}
        </span>
        <select aria-label="테마" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          <option value="system">시스템</option>
          <option value="light">라이트</option>
          <option value="dark">다크</option>
        </select>
      </header>
      <main>
        <StorageCheck />
      </main>
      <footer className="footer">
        <a href="/privacy.html">개인정보처리방침</a>
        {isAnalyticsAvailable() && <AnalyticsToggle />}
      </footer>
    </div>
  );
}

function AnalyticsToggle() {
  const [enabled, setEnabled] = useState(() => !isAnalyticsOptedOut());
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          setEnabled(e.target.checked);
          void setAnalyticsOptOut(!e.target.checked);
        }}
      />
      사용 통계 보내기
    </label>
  );
}
