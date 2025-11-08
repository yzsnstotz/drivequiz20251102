import { test, expect } from "@playwright/test";

test("语言→问卷→车辆→详情→返回", async ({ page }) => {
  await page.goto("/language");
  await page.getByRole("button", { name: /日本語|日本語にする/ }).click();
  await page.goto("/questionnaire");
  await page.getByRole("button", { name: /送信|保存/ }).click();
  await page.goto("/vehicles");
  await page.getByPlaceholder("ブランド").fill("Toyota");
  await page.getByRole("button", { name: /検索|検索する/ }).click();
  await page.getByTestId("vehicle-card-0").click();
  await expect(page.getByText(/年式|価格/)).toBeVisible();
  await page.goBack();
  await expect(page.url()).toContain("/vehicles");
});

