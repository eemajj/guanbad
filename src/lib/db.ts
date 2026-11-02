import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Closing a big session writes a bill per player in one transaction; on a cold serverless start
// that can pass Prisma's 5s default, so give transactions more room.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ transactionOptions: { maxWait: 5_000, timeout: 15_000 } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
