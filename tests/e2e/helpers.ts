import { expect, type Browser, type Page } from "@playwright/test";

/** Log in with the dev provider in a fresh browser context (one context = one person). */
export async function loginAs(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({
    ...(browser.contexts()[0]?.pages()[0] ? {} : {}),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("textbox", { name: "ชื่อผู้ใช้ทดสอบ" }).fill(name);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  return page;
}

/** Wait for a toast containing `text`, then dismiss it so the next assertion starts clean. */
export async function expectToast(page: Page, text: string | RegExp) {
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: text }).last();
  await expect(toast).toBeVisible();
  await toast
    .locator("[data-close-button]")
    .click({ force: true })
    .catch(() => {});
}

/** The open <dialog>, for scoping clicks inside bottom sheets. */
export const openDialog = (page: Page) => page.locator("dialog[open]");
