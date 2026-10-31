import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Creates a new, empty database for this run next to TEST_DATABASE_URL and applies migrations.
 * Nothing existing is wiped. The base name must contain "test" so a real database can't be used by mistake.
 */
export default async function setup() {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("Set TEST_DATABASE_URL, e.g. postgresql://user:pass@localhost:5432/guan_test");
  const url = new URL(base);
  const baseName = url.pathname.slice(1);
  if (!/test/i.test(baseName)) throw new Error(`Test database name "${baseName}" must contain "test"`);
  const name = `${baseName}_${Date.now().toString(36)}`;
  url.pathname = `/${name}`;

  const server = new PrismaClient({ datasources: { db: { url: base } } });
  await server.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  await server.$disconnect();
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url.toString() } });
  process.env.DATABASE_URL = url.toString();
}
