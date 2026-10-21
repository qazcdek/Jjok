// M1-02: 드래그 앤 드롭·여러 파일 업로드, 해시 중복 검사 (F-1.2, F-2.3)
import { expect, test, type Page } from "@playwright/test";
import { pdf, signInAsNewUser } from "./helpers";

/** 브라우저 안에서 DataTransfer 를 만들어 드롭 영역에 drop 이벤트를 보낸다 */
async function dropFiles(page: Page, files: { name: string; type: string; body: string }[]) {
  const dataTransfer = await page.evaluateHandle((specs) => {
    const dt = new DataTransfer();
    for (const f of specs) dt.items.add(new File([f.body], f.name, { type: f.type }));
    return dt;
  }, files);
  const zone = page.getByTestId("dropzone");
  await zone.dispatchEvent("dragover", { dataTransfer });
  await zone.dispatchEvent("drop", { dataTransfer });
}

const queueRow = (page: Page, name: string) =>
  page.locator(".upload-queue > li").filter({ hasText: name });

test("여러 PDF 를 끌어다 놓으면 차례로 올라가고, 같은 파일은 다시 올리지 않는다", async ({
  page,
}) => {
  await page.goto("/");
  await signInAsNewUser(page, "Alice M1-02");

  await dropFiles(page, [
    { name: "attention.pdf", type: "application/pdf", body: pdf("a").toString("latin1") },
    { name: "bert.pdf", type: "application/pdf", body: pdf("b").toString("latin1") },
    { name: "notes.txt", type: "text/plain", body: "hello" },
  ]);
  await expect(queueRow(page, "attention.pdf").getByText("완료")).toBeVisible();
  await expect(queueRow(page, "bert.pdf").getByText("완료")).toBeVisible();
  await expect(queueRow(page, "notes.txt").getByText("PDF가 아님")).toBeVisible();
  await expect(page.getByRole("heading", { name: "논문 (2)" })).toBeVisible();

  // 같은 내용을 다른 이름으로 다시 올리면 중복으로 막힌다 (파일 선택 버튼 경로)
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: "attention-copy.pdf",
    mimeType: "application/pdf",
    buffer: pdf("a"),
  });
  await expect(
    queueRow(page, "attention-copy.pdf").getByText("이미 있음: attention"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "논문 (2)" })).toBeVisible();

  // 다른 논문의 버전으로 추가하려 해도 같은 파일이면 막힌다
  const bert = page.locator(".works > .work").filter({ hasText: "bert" });
  await bert.locator('input[type="file"]').setInputFiles({
    name: "attention-again.pdf",
    mimeType: "application/pdf",
    buffer: pdf("a"),
  });
  await expect(bert.getByText('이미 있는 파일입니다: "attention"')).toBeVisible();
  await expect(bert.locator(".files > li")).toHaveCount(1);

  // 끝난 항목 지우기
  await page.getByRole("button", { name: "끝난 항목 지우기" }).click();
  await expect(page.locator(".upload-queue > li")).toHaveCount(0);
});

test("버전을 지우면 그 파일을 다시 올릴 수 있다", async ({ page }) => {
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await signInAsNewUser(page, "Bob M1-02");

  const input = page.locator('input[type="file"][multiple]');
  await input.setInputFiles({ name: "gpt.pdf", mimeType: "application/pdf", buffer: pdf("g") });
  await expect(queueRow(page, "gpt.pdf").getByText("완료")).toBeVisible();

  const work = page.locator(".works > .work").filter({ hasText: "gpt" });
  await work.locator(".files > li").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("heading", { name: "논문 (0)" })).toBeVisible();

  await input.setInputFiles({ name: "gpt.pdf", mimeType: "application/pdf", buffer: pdf("g") });
  await expect(page.getByRole("heading", { name: "논문 (1)" })).toBeVisible();
});
