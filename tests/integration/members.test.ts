import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  claimMember,
  createClaimLink,
  createMember,
  createMyProfile,
  setMemberActive,
  setUserRole,
  updateMember,
} from "@/features/members/actions";
import { actAs, makeUser } from "./factory";
import { form } from "./helpers";

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeEach(async () => {
  admin = await makeUser("ADMIN");
  actAs(admin);
});

const nick = () => `คน${Math.random().toString(36).slice(2, 7)}`;

describe("member registry", () => {
  it("creates a member and refuses a duplicate nickname (case-insensitive)", async () => {
    const name = nick();
    expect(await createMember(form({ nickname: name, level: "NS", phone: "0812345678" }))).toMatchObject({ ok: true });
    expect(await createMember(form({ nickname: name.toUpperCase(), level: "N" }))).toMatchObject({ ok: false });
  });

  it("validates the phone number", async () => {
    expect(await createMember(form({ nickname: nick(), level: "N", phone: "abc" }))).toEqual({ ok: false, error: "เบอร์โทรไม่ถูกต้อง" });
  });

  it("records a level change in the history", async () => {
    const m = await prisma.member.create({ data: { nickname: nick(), level: "N" } });
    expect(await updateMember(m.id, form({ nickname: m.nickname, level: "S" }))).toMatchObject({ ok: true });
    const a = await prisma.activity.findFirstOrThrow({ where: { type: "member.update" }, orderBy: { at: "desc" } });
    expect(a.summary).toContain("N → S");
  });

  it("a member edits their own profile but not the organiser's private note", async () => {
    const me = await makeUser("MEMBER");
    await prisma.member.update({ where: { id: me.member!.id }, data: { note: "จ่ายช้า" } });
    actAs(me);
    expect(await updateMember(me.member!.id, form({ nickname: me.member!.nickname, level: "S", note: "แก้แล้ว" }))).toMatchObject({
      ok: true,
    });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: me.member!.id } })).note).toBe("จ่ายช้า");
  });

  it("deactivates and reactivates", async () => {
    const m = await prisma.member.create({ data: { nickname: nick() } });
    await setMemberActive(m.id, false);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).active).toBe(false);
    await setMemberActive(m.id, true);
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).active).toBe(true);
  });
});

describe("claim links", () => {
  it("links an organiser-added member to the person's account, once", async () => {
    const m = await prisma.member.create({ data: { nickname: nick() } });
    expect(await createClaimLink(m.id)).toMatchObject({ ok: true });
    const { claimToken } = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });

    const newcomer = await makeUser("MEMBER", false);
    actAs(newcomer);
    expect(await claimMember(claimToken!)).toMatchObject({ ok: true });
    expect((await prisma.member.findUniqueOrThrow({ where: { id: m.id } })).userId).toBe(newcomer.id);

    actAs(await makeUser("MEMBER", false));
    expect(await claimMember(claimToken!)).toEqual({ ok: false, error: "ลิงก์นี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่จากหัวก๊วน" });
  });

  it("refuses an expired link", async () => {
    const m = await prisma.member.create({
      data: { nickname: nick(), claimToken: `t-${nick()}`, claimExpiresAt: new Date(Date.now() - 1000) },
    });
    actAs(await makeUser("MEMBER", false));
    expect(await claimMember(m.claimToken!)).toMatchObject({ ok: false });
  });

  it("cannot create a link for someone already linked", async () => {
    const linked = await makeUser("MEMBER");
    expect(await createClaimLink(linked.member!.id)).toEqual({ ok: false, error: "สมาชิกคนนี้ผูกบัญชีแล้ว" });
  });
});

describe("own profile and roles", () => {
  it("a new user creates their profile once", async () => {
    const u = await makeUser("MEMBER", false);
    actAs(u);
    expect(await createMyProfile(form({ nickname: nick(), level: "N" }))).toMatchObject({ ok: true });
    expect(await prisma.member.count({ where: { userId: u.id } })).toBe(1);
  });

  it("the last organiser cannot demote themself", async () => {
    await prisma.user.updateMany({ where: { role: "ADMIN", id: { not: admin.id } }, data: { role: "MEMBER" } });
    expect(await setUserRole(admin.id, "MEMBER")).toEqual({ ok: false, error: "ต้องมีหัวก๊วนอย่างน้อย 1 คน" });
    const helper = await makeUser("MEMBER");
    expect(await setUserRole(helper.id, "ADMIN")).toMatchObject({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: helper.id } })).role).toBe("ADMIN");
  });
});
