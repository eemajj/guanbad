import "server-only";
import { cache } from "react";
import { prisma } from "@/server/db";

export const getSettings = cache(async () => {
  const s = await prisma.setting.findUnique({ where: { id: "main" } });
  return (
    s ?? {
      id: "main",
      groupName: "ก๊วนแบด",
      promptpayId: null,
      accountName: null,
      defaultVenue: null,
      defaultCourtRate: 18000,
      defaultShuttlePrice: 8500,
    }
  );
});

export const listAdmins = () => prisma.user.findMany({ where: { role: "ADMIN" }, include: { member: true } });
