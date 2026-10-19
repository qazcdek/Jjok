import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "jjok.theme";

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** 라이트/다크 전환 (F-3.4). 기기별 설정. 계정 설정 동기화는 M2 에서 users.settings.theme 로 옮긴다. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // 저장소를 쓸 수 없는 환경이면 이번 세션에만 적용
    }
  }, [theme]);
  return [theme, setTheme];
}
