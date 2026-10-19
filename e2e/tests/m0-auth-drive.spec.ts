// M0 완료 기준 (DevDocs/10-milestone-tasks.md):
//   로그인 후 드라이브에 파일을 올리고 다시 받을 수 있다. 다른 계정의 문서는 읽을 수 없다.
// 에뮬레이터 모드: Auth/Firestore 에뮬레이터 + 메모리 드라이브. 실제 Google Drive 는 수동 점검 (jjok-dev).
import { expect, test, type Page } from "@playwright/test";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

/** Auth 에뮬레이터의 Google 로그인 팝업에서 새 계정을 만들어 로그인한다 */
async function signInAsNewUser(page: Page, name: string) {
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

test("로그인 → 업로드 → 다시 받아 해시 확인 → 다른 계정에서는 보이지 않음", async ({ page }) => {
  await page.goto("/");
  await signInAsNewUser(page, "Alice M0");

  await page.locator('input[type="file"]').setInputFiles({
    name: "attention.pdf",
    mimeType: "application/pdf",
    buffer: PDF,
  });
  const row = page.getByRole("listitem").filter({ hasText: "attention.pdf" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("heading", { name: "올린 파일 (1)" })).toBeVisible();

  await row.getByRole("button", { name: "다시 받아 확인" }).click();
  await expect(row.getByText("해시 일치")).toBeVisible();

  // 다른 계정으로 바꾸면 Alice 의 작품이 보이지 않아야 한다
  await page.getByRole("button", { name: "로그아웃" }).click();
  await signInAsNewUser(page, "Bob M0");
  await expect(page.getByRole("heading", { name: "올린 파일 (0)" })).toBeVisible();
  await expect(page.getByText("attention.pdf")).toHaveCount(0);
});
