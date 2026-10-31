import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { e2eDatabaseUrl } from "./db";

export const ADMIN = "หัวก๊วน";

/** Create this run's database, apply migrations, and add the organiser account the tests log in as. */
export default async function globalSetup() {
  const { base, url, name } = e2eDatabaseUrl();

  const server = new PrismaClient({ datasources: { db: { url: base } } });
  await server.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
  await server.$disconnect();

  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await prisma.user.create({ data: { lineId: `dev:${ADMIN}`, name: ADMIN, role: "ADMIN" } });
  await prisma.$disconnect();
}
