// M1-T5: 자동으로 확정하지 못한 논문 정보를 사용자가 확인·수정한다 (F-1.2)
// 백엔드 서버는 띄우지 않고 metadata-lookup 응답을 흉내 낸다.
import { expect, test, type Page, type Route } from "@playwright/test";
import { makeTextPdf } from "../../apps/web/src/lib/pdf/testing";
import { signInAsNewUser } from "./helpers";

const cors = { "access-control-allow-origin": "*" };

const resnet = {
  source: "openalex",
  method: "title-search",
  title: "Deep Residual Learning for Image Recognition",
  authors: [{ name: "Kaiming He" }, { name: "Xiangyu Zhang" }],
  year: 2016,
  venue: "CVPR",
  kind: "conference",
  ids: { doi: "10.1109/cvpr.2016.90", openalex: "W2194775991" },
  score: 0.8,
};
const other = { ...resnet, title: "Residual Networks Behave Like Ensembles", score: 0.76 };

async function upload(page: Page, name: string, title: string) {
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(makeTextPdf([{ text: title, size: 16, y: 700 }])),
  });
  await expect(
    page.locator(".upload-queue > li").filter({ hasText: name }).getByText(/^완료/),
  ).toBeVisible();
}

test("확인 필요 논문에서 후보를 골라 저장하고, 못 찾은 논문은 직접 입력한다", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/v1/tools/metadata-lookup", async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    const body = route.request().postDataJSON() as { title?: string; arxiv?: string };
    requests.push(body);
    const json = body.title?.startsWith("Deep Residual")
      ? { status: "ambiguous", candidates: [resnet, other], tried: [] }
      : { status: "not_found", candidates: [], tried: [] };
    await route.fulfill({ json, headers: cors });
  });

  await page.goto("/");
  await signInAsNewUser(page, "Alice M1-T5");

  // 1) 후보만 있는 논문: 확인 필요 → 다시 찾기 → 후보 선택
  await upload(page, "resnet.pdf", "Deep Residual Learning");
  const work = page.locator(".works > .work").filter({ hasText: "Deep Residual Learning" });
  await expect(work.getByText("정보 확인 필요")).toBeVisible();
  await work.getByRole("button", { name: "정보 확인" }).click();
  await work.getByRole("button", { name: "다시 찾기" }).click();
  await expect(work.locator(".candidates > li")).toHaveCount(2);
  await work
    .locator(".candidates > li")
    .filter({ hasText: "Deep Residual Learning for Image Recognition" })
    .getByRole("button", { name: "이 정보로 저장" })
    .click();
  await expect(work.getByTestId("metadata-review")).toBeHidden();
  await expect(work.locator("strong").first()).toHaveText(
    "Deep Residual Learning for Image Recognition",
  );
  await expect(work.getByText("Kaiming He, Xiangyu Zhang · CVPR · 2016")).toBeVisible();
  await expect(work.getByText("정보 확인 필요")).toBeHidden();

  // 2) 못 찾은 논문: arXiv ID 로 다시 찾아도 없음 → 직접 입력
  await upload(page, "notes.pdf", "My Lab Seminar Notes");
  const mine = page.locator(".works > .work").filter({ hasText: "My Lab Seminar Notes" });
  await expect(mine.getByText("정보 확인 필요")).toBeVisible();
  await mine.getByRole("button", { name: "정보 확인" }).click();
  const panel = mine.getByTestId("metadata-review");
  await panel.getByLabel("DOI, arXiv ID 또는 제목").fill("2106.09685");
  await panel.getByRole("button", { name: "다시 찾기" }).click();
  await expect(panel.getByText("찾지 못했습니다")).toBeVisible();
  expect(requests.at(-1)).toEqual({ arxiv: "2106.09685" });

  await panel.getByLabel("제목", { exact: true }).fill("Seminar Notes on LoRA");
  await panel.getByLabel(/저자/).fill("Alice, Bob");
  await panel.getByLabel("연도").fill("20");
  await panel.getByRole("button", { name: "입력한 정보로 저장" }).click();
  await expect(panel.getByText("연도는 네 자리 숫자로 입력하세요.")).toBeVisible();
  await panel.getByLabel("연도").fill("2024");
  await panel.getByRole("button", { name: "입력한 정보로 저장" }).click();
  await expect(panel).toBeHidden();

  const saved = page.locator(".works > .work").filter({ hasText: "Seminar Notes on LoRA" });
  await expect(saved.getByText("Alice, Bob · 2024")).toBeVisible();
  await expect(saved.getByText("정보 확인 필요")).toBeHidden();
  await expect(saved.getByRole("button", { name: "정보 수정" })).toBeVisible();

  // 새로고침해도 유지된다 (Firestore 에 저장됨)
  await page.reload();
  await expect(page.getByText("Seminar Notes on LoRA")).toBeVisible();
  await expect(page.getByText("정보 확인 필요")).toHaveCount(0);
});
