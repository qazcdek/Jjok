// M0 완료 기준 (DevDocs/10-milestone-tasks.md):
//   로그인 후 드라이브에 파일을 올리고 다시 받을 수 있다. 다른 계정의 문서는 읽을 수 없다.
// 에뮬레이터 모드: Auth/Firestore 에뮬레이터 + 메모리 드라이브. 실제 Google Drive 는 수동 점검 (jjok-dev).
import { expect, test } from "@playwright/test";
import { pdf, signInAsNewUser } from "./helpers";

test("로그인 → 업로드 → 다시 받아 해시 확인 → 다른 계정에서는 보이지 않음", async ({ page }) => {
  await page.goto("/");
  await signInAsNewUser(page, "Alice M0");

  await page.locator('input[type="file"]').setInputFiles({
    name: "attention.pdf",
    mimeType: "application/pdf",
    buffer: pdf(),
  });
  // 논문 > 버전 목록 중 버전 행
  const row = page.locator(".files > li").filter({ hasText: "attention.pdf" });
  await expect(row).toBeVisible();
  await expect(page.getByRole("heading", { name: "논문 (1)" })).toBeVisible();

  await row.getByRole("button", { name: "다시 받아 확인" }).click();
  await expect(row.getByText("해시 일치")).toBeVisible();

  // 다른 계정으로 바꾸면 Alice 의 논문이 보이지 않아야 한다
  await page.getByRole("button", { name: "로그아웃" }).click();
  await signInAsNewUser(page, "Bob M0");
  await expect(page.getByRole("heading", { name: "논문 (0)" })).toBeVisible();
  await expect(page.getByText("attention.pdf")).toHaveCount(0);
});
