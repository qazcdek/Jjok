// Google Analytics (ADR-0011). 개인정보처리방침 §1·§7 과 같이 유지한다.
//
// 원칙
// - 에뮬레이터 모드이거나 measurementId 가 없으면 불러오지 않는다.
// - Google 신호·광고 개인화는 끈다.
// - 이벤트에 개인정보·사용자 콘텐츠(이메일, uid, 논문 제목, 노트·하이라이트 내용, 검색어)를 넣지 않는다.
// - 사용자가 끌 수 있다 (기기별 설정).
import type { Analytics } from "firebase/analytics";
import { env } from "../env";
import { firebaseApp } from "./app";

const OPT_OUT_KEY = "jjok.analytics";

let instance: Analytics | null = null;

export function isAnalyticsAvailable(): boolean {
  return !env.useEmulators && Boolean(env.firebase.measurementId);
}

export function isAnalyticsOptedOut(storage: Pick<Storage, "getItem"> = localStorage): boolean {
  try {
    return storage.getItem(OPT_OUT_KEY) === "off";
  } catch {
    return false;
  }
}

function disableFlagName(measurementId: string): string {
  return `ga-disable-${measurementId}`;
}

/** 앱 시작 시 한 번 호출. 실패해도 앱 동작에는 영향이 없다. */
export async function initAnalytics(): Promise<void> {
  const measurementId = env.firebase.measurementId;
  if (!isAnalyticsAvailable() || !measurementId || instance) return;
  // 수집을 끈 사용자는 첫 page_view 도 보내지 않도록 초기화 전에 막는다
  (window as unknown as Record<string, boolean>)[disableFlagName(measurementId)] =
    isAnalyticsOptedOut();
  const { initializeAnalytics, isSupported } = await import("firebase/analytics");
  if (!(await isSupported())) return;
  instance = initializeAnalytics(firebaseApp, {
    config: {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    },
  });
}

export async function setAnalyticsOptOut(optOut: boolean): Promise<void> {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, "off");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 이번 세션에만 적용
  }
  const measurementId = env.firebase.measurementId;
  if (!measurementId) return;
  (window as unknown as Record<string, boolean>)[disableFlagName(measurementId)] = optOut;
  if (instance) {
    const { setAnalyticsCollectionEnabled } = await import("firebase/analytics");
    setAnalyticsCollectionEnabled(instance, !optOut);
  } else if (!optOut) {
    await initAnalytics();
  }
}
