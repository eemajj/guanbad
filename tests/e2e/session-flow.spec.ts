import { expect, test } from "@playwright/test";
import { ADMIN } from "./global-setup";
import { expectToast, loginAs, openDialog } from "./helpers";

/**
 * One whole evening at the court, as two real people would do it:
 * organiser opens a round → friend signs up → play → bills → friend pays → organiser confirms.
 */
test("organiser and member go through a full session", async ({ browser }) => {
  const org = await loginAs(browser, ADMIN);

  // Payment settings
  await org.goto("/settings");
  await org.getByLabel("พร้อมเพย์ (เบอร์มือถือ หรือเลขบัตรประชาชน)").fill("0812345678");
  await org.getByRole("button", { name: "บันทึก" }).click();
  await expectToast(org, "บันทึกการตั้งค่าแล้ว");

  // Open a session
  await org.goto("/sessions/new");
  await org.getByLabel("สนาม").fill("สนามทดสอบ E2E");
  await org.getByLabel("หมายเลขคอร์ท").fill("5");
  await org.getByRole("button", { name: "เปิดรอบ" }).click();
  await org.waitForURL(/\/sessions\/c/);
  const sessionUrl = new URL(org.url()).pathname;

  // Organiser adds four new people
  for (const name of ["ต้น", "เอ", "บีม", "ฝน"]) {
    await org.getByRole("button", { name: "+ คนใหม่" }).click();
    await openDialog(org).getByLabel("ชื่อเล่น").fill(name);
    await openDialog(org).getByRole("button", { name: "เพิ่ม" }).click();
    await expectToast(org, `เพิ่ม ${name} แล้ว`);
  }

  // A friend logs in, creates a profile and signs up
  const friend = await loginAs(browser, "โจ้ทดสอบ");
  await expect(friend).toHaveURL(/\/welcome/);
  await friend.getByLabel("ชื่อเล่น (ชื่อที่เพื่อนในก๊วนเรียก)").fill("โจ้");
  await friend.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await expectToast(friend, "ยินดีต้อนรับ โจ้");
  await friend.goto(sessionUrl);
  await friend.getByRole("button", { name: "ลงชื่อ", exact: true }).click();
  await expectToast(friend, "ลงชื่อแล้ว");
  await expect(friend.getByText("ลงชื่อแล้ว ✓")).toBeVisible();

  // Start: one court, five players → one game, one waiting
  await org.reload();
  await org.getByRole("button", { name: "เริ่มตี" }).first().click();
  await expectToast(org, "จัดคู่ลง 1 คอร์ท");

  // Finish the game with points; the next game is assigned automatically
  await org.goto(`${sessionUrl}?tab=courts`);
  await org.getByRole("button", { name: "จบเกม" }).click();
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .first()
    .fill("21");
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .last()
    .fill("17");
  await expect(openDialog(org).getByText("ระบบคิดผู้ชนะจากแต้มให้แล้ว")).toBeVisible();
  await openDialog(org).getByRole("button", { name: "บันทึก แล้วจัดคู่ถัดไป" }).click();
  await expectToast(org, "เกมใหม่ลงคอร์ท 5");
  await expect(org.getByText("21–17")).toBeVisible();

  // Close the session and issue bills
  await org.goto(sessionUrl);
  await org.getByRole("button", { name: "จบรอบ & ออกบิล" }).click();
  await org.getByRole("button", { name: "ยืนยันจบรอบและออกบิล" }).click();
  await expectToast(org, "ออกบิลให้ทุกคนแล้ว");

  // Friend pays with the PromptPay QR and reports the transfer
  await friend.goto(sessionUrl);
  await friend.getByRole("link", { name: "จ่ายเงิน" }).first().click();
  await expect(friend.getByRole("img", { name: /QR พร้อมเพย์ ยอด/ })).toBeVisible();
  await friend.getByRole("button", { name: "โอนแล้ว แจ้งหัวก๊วน" }).click();
  await expectToast(friend, "แจ้งโอนแล้ว");

  // Organiser confirms from the dashboard
  await org.goto("/");
  await expect(org.getByText("รอยืนยันการโอน 1 รายการ")).toBeVisible();
  await org.getByRole("button", { name: "ยืนยันรับเงิน" }).click();
  await expectToast(org, "ได้รับเงินแล้ว");
});
