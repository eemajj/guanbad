import { expect, test } from "@playwright/test";
import { ADMIN } from "./global-setup";
import { expectToast, loginAs, openDialog } from "./helpers";

test.describe.configure({ mode: "serial" });

test("results: half-filled points are rejected, results can be filled in later", async ({ browser }) => {
  const org = await loginAs(browser, ADMIN);
  await org.goto("/sessions/new");
  await org.getByLabel("สนาม").fill("สนามทดสอบผล");
  await org.getByLabel("หมายเลขคอร์ท").fill("1");
  await org.getByRole("button", { name: "เปิดรอบ" }).click();
  await org.waitForURL(/\/sessions\/c/);
  const url = new URL(org.url()).pathname;

  for (const name of ["ก", "ข", "ค", "ง"]) {
    await org.getByRole("button", { name: "+ คนใหม่" }).click();
    await openDialog(org).getByLabel("ชื่อเล่น").fill(`ผล-${name}`);
    await openDialog(org).getByRole("button", { name: "เพิ่ม" }).click();
    await expectToast(org, "แล้ว");
  }
  await org.getByRole("button", { name: "เริ่มตี" }).first().click();
  await expectToast(org, "เริ่มแล้ว");
  await org.goto(`${url}?tab=courts`);

  // Only one side → server refuses with a clear message
  await org.getByRole("button", { name: "จบเกม" }).click();
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .first()
    .fill("21");
  await openDialog(org).getByRole("button", { name: "บันทึก แล้วจัดคู่ถัดไป" }).click();
  await expectToast(org, "ใส่แต้มให้ครบทั้งสองฝั่ง");

  // Save with no result at all (organiser forgot)
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .first()
    .fill("");
  await openDialog(org).getByRole("button", { name: "บันทึก แล้วจัดคู่ถัดไป" }).click();
  await expectToast(org, "บันทึกแล้ว");
  await expect(org.getByText("ยังไม่บันทึกผล").first()).toBeVisible();

  // Fill it in afterwards
  await org.getByRole("button", { name: "ใส่ผล" }).click();
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .first()
    .fill("15");
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .last()
    .fill("21");
  await openDialog(org).getByRole("button", { name: "บันทึกผล" }).click();
  await expectToast(org, "บันทึกผลแล้ว");
  await expect(org.getByText("15–21")).toBeVisible();
});

test("members cannot reach organiser pages or controls", async ({ browser }) => {
  const member = await loginAs(browser, "สมาชิกทดสอบ");
  await member.getByLabel("ชื่อเล่น (ชื่อที่เพื่อนในก๊วนเรียก)").fill("นัท");
  await member.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await member.waitForURL("/");

  for (const path of ["/finance", "/members", "/settings", "/sessions/new"]) {
    await member.goto(path);
    // Members are sent to their own dashboard instead of the organiser page.
    await expect(member.getByRole("heading", { level: 1 })).toContainText("นัท");
  }
  await member.goto("/sessions");
  await expect(member.getByRole("link", { name: "+ เปิดรอบใหม่" })).toHaveCount(0);
});
