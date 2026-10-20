// M1-01: 판 추가, 대표 버전 지정, 판 삭제 (F-1.4, F-1.4.1)
import { expect, test } from "@playwright/test";
import { pdf, signInAsNewUser } from "./helpers";

test("판을 추가하고 대표 버전을 바꾸고, 판을 지우면 마지막에는 작품도 지워진다", async ({
  page,
}) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await signInAsNewUser(page, "Alice M1");

  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "attention-arxiv.pdf",
      mimeType: "application/pdf",
      buffer: pdf("v1"),
    });
  await expect(page.getByRole("heading", { name: "작품 (1)" })).toBeVisible();
  const work = page.locator(".works > .work").filter({ hasText: "attention-arxiv" });
  const versionRow = (name: string) => work.locator(".files > li").filter({ hasText: name });

  // 같은 작품에 두 번째 판 추가: 대표는 그대로 첫 판
  await work.locator('input[type="file"]').setInputFiles({
    name: "attention-neurips.pdf",
    mimeType: "application/pdf",
    buffer: pdf("neurips"),
  });
  await expect(versionRow("attention-neurips.pdf")).toBeVisible();
  await expect(page.getByRole("heading", { name: "작품 (1)" })).toBeVisible();
  await expect(versionRow("attention-arxiv.pdf").getByText("대표", { exact: true })).toBeVisible();

  // 대표 버전 변경
  await versionRow("attention-neurips.pdf").getByRole("button", { name: "대표로 지정" }).click();
  await expect(
    versionRow("attention-neurips.pdf").getByText("대표", { exact: true }),
  ).toBeVisible();
  await expect(
    versionRow("attention-arxiv.pdf").getByRole("button", { name: "대표로 지정" }),
  ).toBeVisible();

  // 대표가 아닌 판 삭제
  await versionRow("attention-arxiv.pdf").getByRole("button", { name: "삭제" }).click();
  await expect(versionRow("attention-arxiv.pdf")).toHaveCount(0);

  // 새로고침해도 대표 버전이 유지된다
  await page.reload();
  await expect(
    versionRow("attention-neurips.pdf").getByText("대표", { exact: true }),
  ).toBeVisible();

  // 마지막 판을 지우면 작품도 사라진다
  await versionRow("attention-neurips.pdf").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("heading", { name: "작품 (0)" })).toBeVisible();
});
