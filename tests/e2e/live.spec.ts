import { expect, test } from "@playwright/test";
import { ADMIN } from "./global-setup";
import { expectToast, loginAs, openDialog } from "./helpers";

/** Two phones at the court: what the organiser does shows up on a member's screen within a few seconds. */
test("a member's screen follows the organiser without reloading for nothing", async ({ browser }) => {
  test.setTimeout(60_000);
  const org = await loginAs(browser, ADMIN);
  await org.goto("/sessions/new");
  await org.getByLabel("สนาม").fill("สนามทดสอบสด");
  await org.getByLabel("หมายเลขคอร์ท").fill("1");
  await org.getByRole("button", { name: "เปิดรอบ" }).click();
  await org.waitForURL(/\/sessions\/c/);
  const url = new URL(org.url()).pathname;
  const id = url.split("/").pop()!;
  for (const n of ["สด1", "สด2", "สด3", "สด4", "สด5"]) {
    await org.getByRole("button", { name: "+ คนใหม่" }).click();
    await openDialog(org).getByLabel("ชื่อเล่น").fill(n);
    await openDialog(org).getByRole("button", { name: "เพิ่ม" }).click();
    await expectToast(org, `เพิ่ม ${n} แล้ว`);
  }
  await org.getByRole("button", { name: "เริ่มตี" }).first().click();
  await expectToast(org, "เริ่มแล้ว");

  // The version endpoint is tiny.
  const res = await org.request.get(`/api/sessions/${id}/version`);
  const body = await res.body();
  expect(body.length).toBeLessThan(1024);
  expect(JSON.parse(body.toString())).toHaveProperty("v");

  // A member watches the courts.
  const member = await loginAs(browser, "ผู้ชมทดสอบ");
  await member.getByLabel("ชื่อเล่น (ชื่อที่เพื่อนในก๊วนเรียก)").fill("ผู้ชม");
  await member.getByRole("button", { name: "เริ่มใช้งาน" }).click();
  await member.waitForURL("/");
  await member.goto(`${url}?tab=courts`);
  await expect(member.getByText("ยังไม่มีเกมที่จบ")).toBeVisible();

  // Count page refreshes on the member's phone while nothing changes. Link prefetches are not
  // refreshes (Next 16 schedules them when the browser is idle, so they can land in this window).
  const refreshes: string[] = [];
  member.on("request", (r) => {
    const h = r.headers();
    if (h["rsc"] === "1" && !h["next-router-prefetch"]) refreshes.push(r.url());
  });
  await member.waitForTimeout(7000);
  expect(refreshes).toEqual([]);

  // Organiser finishes the game; time how long until the next game is on court.
  await org.goto(`${url}?tab=courts`);
  await org.getByRole("button", { name: "จบเกม" }).click();
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .first()
    .fill("21");
  await openDialog(org)
    .getByLabel(/^แต้มของ/)
    .last()
    .fill("15");
  const t0 = Date.now();
  await openDialog(org).getByRole("button", { name: "บันทึก แล้วจัดคู่ถัดไป" }).click();
  await expectToast(org, "เกมใหม่ลงคอร์ท 1");
  const finishMs = Date.now() - t0;
  test.info().annotations.push({ type: "finish→next game (ms)", description: String(finishMs) });
  expect(finishMs).toBeLessThan(1500);

  // Usually within one or two polls (3 s each). Worst case: 2 soft retries, then a full reload (~10 s).
  const t1 = Date.now();
  await expect(member.getByText("21–15")).toBeVisible({ timeout: 15000 });
  test.info().annotations.push({ type: "member saw result after (ms)", description: String(Date.now() - t1) });
});
