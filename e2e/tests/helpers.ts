// E2E 공용 도우미: 에뮬레이터 Google 로그인, 테스트용 PDF
import { expect, type Page } from "@playwright/test";

/** 내용이 다른 최소 PDF. 해시가 달라야 별개 파일로 다뤄진다 */
export function pdf(tag = ""): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n" +
      `%${tag}\n%%EOF\n`,
  );
}

/** Auth 에뮬레이터의 Google 로그인 팝업에서 새 계정을 만들어 로그인한다 */
export async function signInAsNewUser(page: Page, name: string) {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Google로 로그인" }).click();
  const popup = await popupPromise;
  // 느린 환경(CI)에서는 팝업 스크립트가 준비되기 전에 누른 클릭이 무시된다.
  // 계정 입력 화면이 나타날 때까지 "Add new account" 를 다시 누른다.
  const autoGenerate = popup.getByRole("button", { name: /auto-generate user information/i });
  await expect(async () => {
    if (!(await autoGenerate.isVisible())) {
      await popup.getByRole("button", { name: /add new account/i }).click({ timeout: 2_000 });
    }
    await expect(autoGenerate).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await autoGenerate.click();
  // 에뮬레이터 화면의 입력란은 label 이 연결되어 있지 않다: Email, Display name 순서
  await popup.getByRole("textbox").nth(1).fill(name);
  await Promise.all([
    popup.waitForEvent("close"),
    popup.getByRole("button", { name: /sign in with google/i }).click(),
  ]);
  await expect(page.getByText(name)).toBeVisible();
}
