import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton so hot-reload doesn't exhaust the
// Supabase connection pool. Every module should import `prisma` from here
// rather than instantiating its own PrismaClient.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Prisma's default interactive-transaction timeout is 5000ms, which is too
// tight for a multi-query `$transaction` against a remote DB with real
// network latency (checkout deducts stock per line + creates the
// transaction/bill/tenders in one transaction — several sequential round
// trips). Pass as the second arg: `prisma.$transaction(async (tx) => {...},
// TRANSACTION_OPTIONS)`.
export const TRANSACTION_OPTIONS = { timeout: 20000, maxWait: 10000 };
