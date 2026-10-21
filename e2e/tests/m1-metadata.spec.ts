// M1-T4: 업로드 후 백엔드 서버 metadata-lookup 결과로 논문·버전 정보를 채운다 (F-1.2)
// 백엔드 서버는 띄우지 않고 응답을 흉내 낸다. 서버 쪽은 services/api/tests 가 확인한다.
import { expect, test, type Page } from "@playwright/test";
import { makeTextPdf } from "../../apps/web/src/lib/pdf/testing";
import { signInAsNewUser } from "./helpers";

const resnetPdf = Buffer.from(
  makeTextPdf([
    { text: "Deep Residual Learning for Image Recognition", size: 16, y: 700 },
    { text: "Kaiming He", size: 11, y: 670 },
    { text: "DOI: 10.1109/CVPR.2016.90", size: 8, y: 60 },
  ]),
);

const found = {
  status: "found",
  match: {
    source: "crossref",
    method: "identifier",
    title: "Deep Residual Learning for Image Recognition",
    authors: [{ name: "Kaiming He", given: "Kaiming", family: "He" }],
    year: 2016,
    venue: "CVPR",
    kind: "conference",
    ids: { doi: "10.1109/cvpr.2016.90" },
  },
  candidates: [],
  tried: [{ source: "crossref", outcome: "found" }],
};

async function upload(page: Page, name: string, buffer: Buffer) {
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer,
  });
}

test("메타데이터를 찾으면 버전 이름이 학회·연도가 되고, 조회가 실패해도 업로드는 남는다", async ({
  page,
}) => {
  const requests: unknown[] = [];
  let respond: "found" | "fail" = "found";
  await page.route("**/v1/tools/metadata-lookup", async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    requests.push(route.request().postDataJSON());
    expect(route.request().headers()["authorization"]).toMatch(/^Bearer .+/);
    await route.fulfill(
      respond === "found"
        ? { json: found, headers: { "access-control-allow-origin": "*" } }
        : {
            status: 502,
            json: { error: { code: "upstream_error", message: "실패" } },
            headers: { "access-control-allow-origin": "*" },
          },
    );
  });

  await page.goto("/");
  await signInAsNewUser(page, "Alice M1-T4");

  await upload(page, "resnet.pdf", resnetPdf);
  const row = page.locator(".upload-queue > li").filter({ hasText: "resnet.pdf" });
  await expect(row.getByText("완료 · 정보 찾음")).toBeVisible();
  expect(requests[0]).toEqual({
    doi: "10.1109/cvpr.2016.90",
    title: "Deep Residual Learning for Image Recognition",
  });
  const work = page.locator(".works > .work").filter({ hasText: "Deep Residual Learning" });
  await expect(work.locator(".files > li")).toHaveText(/CVPR 2016 · resnet\.pdf/);

  respond = "fail";
  await upload(
    page,
    "other.pdf",
    Buffer.from(makeTextPdf([{ text: "Some Other Paper Title", size: 16, y: 700 }])),
  );
  const failed = page.locator(".upload-queue > li").filter({ hasText: "other.pdf" });
  await expect(failed.getByText("완료 · 정보 조회 실패")).toBeVisible();
  await expect(page.getByRole("heading", { name: "논문 (2)" })).toBeVisible();
});
