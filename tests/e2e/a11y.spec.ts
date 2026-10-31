import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN } from "./global-setup";
import { expectToast, loginAs, openDialog } from "./helpers";

/** Run axe and fail on serious or critical problems (contrast, missing labels, invalid ARIA, ...). */
async function checkPage(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  // The axe package types against a newer Playwright; the runtime API is the same.
  const { violations } = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Toasts are scanned while fading out (half transparent), which reads as low contrast; their colours come from app tokens.
    .exclude("[data-sonner-toaster]")
    .analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const summary = bad.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(", ")}`,
  );
  expect(summary, `accessibility problems on ${label}`).toEqual([]);
}

test("main screens have no serious accessibility problems", async ({ browser }) => {
  test.setTimeout(120_000);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/login");
  await checkPage(visitor, "login");

  const org = await loginAs(browser, ADMIN);
  await org.goto("/sessions/new");
  await checkPage(org, "new session form");
  await org.getByLabel("สนาม").fill("สนามตรวจ a11y");
  await org.getByLabel("หมายเลขคอร์ท").fill("1");
  await org.getByRole("button", { name: "เปิดรอบ" }).click();
  await org.waitForURL(/\/sessions\/c/);
  const url = new URL(org.url()).pathname;
  const id = url.split("/").pop()!;
  for (const n of ["ก1", "ก2", "ก3", "ก4"]) {
    await org.getByRole("button", { name: "+ คนใหม่" }).click();
    await openDialog(org).getByLabel("ชื่อเล่น").fill(n);
    await openDialog(org).getByRole("button", { name: "เพิ่ม" }).click();
    await expectToast(org, `เพิ่ม ${n} แล้ว`);
  }
  await checkPage(org, "session · players (open)");
  await org.getByRole("button", { name: "เริ่มตี" }).first().click();
  await expectToast(org, "เริ่มแล้ว");
  await org.goto(`${url}?tab=courts`);
  await checkPage(org, "session · courts (live)");
  await org.getByRole("button", { name: "จบเกม" }).click();
  await checkPage(org, "finish game sheet");
  await openDialog(org).getByRole("button", { name: "บันทึก แล้วจัดคู่ถัดไป" }).click();
  await expectToast(org, "บันทึกแล้ว");

  await org.goto(`/board/${id}`);
  await checkPage(org, "court board");

  await org.goto(url);
  await org.getByRole("button", { name: "จบรอบ & ออกบิล" }).click();
  await org.getByRole("button", { name: "ยืนยันจบรอบ" }).click();
  await expectToast(org, "ออกบิล");
  for (const tab of ["bills", "history"]) {
    await org.goto(`${url}?tab=${tab}`);
    await checkPage(org, `session · ${tab}`);
  }
  await org.goto(`${url}?tab=bills`);
  await org.getByRole("link", { name: "QR" }).first().click();
  await org.waitForURL(/\/pay\//);
  await checkPage(org, "payment page");

  for (const path of ["/", "/sessions", "/stats?p=all", "/members", "/finance", "/settings", "/activity", "/me"]) {
    await org.goto(path);
    await checkPage(org, path);
  }
});
