// M1-03: 업로드할 때 PDF 에서 제목 후보·arXiv ID·DOI 를 찾는다 (F-1.2)
import { expect, test } from "@playwright/test";
import { makeTextPdf } from "../../apps/web/src/lib/pdf/testing";
import { pdf, signInAsNewUser } from "./helpers";

test("PDF 첫 페이지의 제목과 arXiv ID 로 논문·버전 이름을 정하고, 읽을 수 없는 PDF 는 파일 이름을 쓴다", async ({
  page,
}) => {
  await page.goto("/");
  await signInAsNewUser(page, "Alice M1-03");

  const input = page.locator('input[type="file"][multiple]');
  await input.setInputFiles([
    {
      name: "1706.03762v7.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(
        makeTextPdf([
          { text: "Attention Is All You Need", size: 17, y: 700 },
          { text: "Ashish Vaswani", size: 11, y: 670 },
          { text: "The dominant sequence transduction models are based on", size: 10, y: 500 },
          { text: "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023", size: 20, y: 300, x: 20 },
        ]),
      ),
    },
    { name: "broken.pdf", mimeType: "application/pdf", buffer: pdf("broken") },
  ]);

  const attention = page.locator(".works > .work").filter({ hasText: "Attention Is All You Need" });
  await expect(attention.locator(".files > li")).toHaveText(/arXiv v7 · 1706\.03762v7\.pdf/);
  const broken = page.locator(".works > .work").filter({ hasText: "broken" });
  await expect(broken.locator(".files > li")).toHaveText(/업로드 · broken\.pdf/);
  await expect(page.getByRole("heading", { name: "논문 (2)" })).toBeVisible();
});
