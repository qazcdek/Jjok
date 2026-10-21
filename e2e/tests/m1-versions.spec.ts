// M1-T1: 버전 추가, 기본 버전 지정, 버전 삭제 (F-1.4, F-1.4.1)
import { expect, test } from "@playwright/test";
import { pdf, signInAsNewUser } from "./helpers";

test("버전을 추가하고 기본 버전을 바꾸고, 버전을 지우면 마지막에는 논문도 지워진다", async ({
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
  await expect(page.getByRole("heading", { name: "논문 (1)" })).toBeVisible();
  const work = page.locator(".works > .work").filter({ hasText: "attention-arxiv" });
  const versionRow = (name: string) => work.locator(".files > li").filter({ hasText: name });

  // 같은 논문에 두 번째 버전 추가: 기본 버전은 그대로 첫 버전
  await work.locator('input[type="file"]').setInputFiles({
    name: "attention-neurips.pdf",
    mimeType: "application/pdf",
    buffer: pdf("neurips"),
  });
  await expect(versionRow("attention-neurips.pdf")).toBeVisible();
  await expect(page.getByRole("heading", { name: "논문 (1)" })).toBeVisible();
  await expect(versionRow("attention-arxiv.pdf").getByText("기본", { exact: true })).toBeVisible();

  // 기본 버전 변경
  await versionRow("attention-neurips.pdf").getByRole("button", { name: "기본으로 지정" }).click();
  await expect(
    versionRow("attention-neurips.pdf").getByText("기본", { exact: true }),
  ).toBeVisible();
  await expect(
    versionRow("attention-arxiv.pdf").getByRole("button", { name: "기본으로 지정" }),
  ).toBeVisible();

  // 기본 버전이 아닌 버전 삭제
  await versionRow("attention-arxiv.pdf").getByRole("button", { name: "삭제" }).click();
  await expect(versionRow("attention-arxiv.pdf")).toHaveCount(0);

  // 새로고침해도 기본 버전이 유지된다
  await page.reload();
  await expect(
    versionRow("attention-neurips.pdf").getByText("기본", { exact: true }),
  ).toBeVisible();

  // 지운 버전의 파일은 중복 목록에서도 빠져 다시 올릴 수 있다 (fileHashes, M1-T2)
  // 내용은 지운 버전과 같고 이름만 다른 파일
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "arxiv-again.pdf",
    mimeType: "application/pdf",
    buffer: pdf("v1"),
  });
  await expect(page.getByRole("heading", { name: "논문 (2)" })).toBeVisible();

  // 마지막 버전을 지우면 논문도 사라진다
  await versionRow("attention-neurips.pdf").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("heading", { name: "논문 (1)" })).toBeVisible();
  await expect(work).toHaveCount(0);
});
