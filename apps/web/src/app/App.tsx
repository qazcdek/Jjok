import { env } from "../lib/env";
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
    </div>
  );
}
