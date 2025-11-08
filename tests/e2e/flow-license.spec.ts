import { test, expect } from "@playwright/test";

test("驾照学习→考试→错题本", async ({ page }) => {
  await page.goto("/license");
  await page.getByRole("link", { name: /仮免|本免/ }).first().click();
  await page.getByRole("button", { name: /次へ|Next/ }).click(); // 模拟几题
  await page.getByRole("button", { name: /ブックマーク|错题|保存/ }).first().click();
  await page.goto("/license/exam/provisional");
  await page.getByRole("button", { name: /提出|Submit/ }).click();
  await expect(page.getByText(/得点|Score/)).toBeVisible();
  await page.goto("/license/mistakes");
  await expect(page.getByTestId("mistake-item-0")).toBeVisible();
});

