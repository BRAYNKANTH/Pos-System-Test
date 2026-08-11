import { prisma, TRANSACTION_OPTIONS } from "@/lib/prisma";

// Single-till assumption, matching the rest of the app (one location, one
// POS terminal in practice) — only one RegisterSession can be open at a
// time across the whole business, not per-cashier. Whoever opens it,
// anyone with REGISTER_CLOSE can close it (shift handover without
// needing the same person to open and close).

export class RegisterAlreadyOpenError extends Error {
  constructor() {
    super("A register session is already open");
  }
}

export class NoOpenRegisterError extends Error {
  constructor() {
    super("No register session is currently open");
  }
}

export async function getOpenRegisterSession() {
  return prisma.registerSession.findFirst({
    where: { status: "open" },
    include: { openedBy: { select: { name: true } }, cashMovements: true },
  });
}

export async function openRegisterSession(openedById: string, openingFloat: number) {
  const existing = await getOpenRegisterSession();
  if (existing) throw new RegisterAlreadyOpenError();

  return prisma.registerSession.create({
    data: { openedById, openingFloat },
  });
}

export async function recordCashMovement(params: {
  sessionId: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  createdById: string;
}) {
  const session = await prisma.registerSession.findUnique({ where: { id: params.sessionId } });
  if (!session || session.status !== "open") throw new NoOpenRegisterError();

  return prisma.cashMovement.create({
    data: {
      sessionId: params.sessionId,
      type: params.type,
      amount: params.amount,
      reason: params.reason,
      createdById: params.createdById,
    },
  });
}

/** Expected cash in the drawer: opening float + cash tenders from sales
 * linked to this session + cash-in movements − cash-out movements. Card/
 * wallet tenders don't touch the physical drawer, so only "cash" tenders
 * count. */
export async function computeExpectedCash(sessionId: string): Promise<number> {
  const session = await prisma.registerSession.findUniqueOrThrow({ where: { id: sessionId } });

  const cashTenders = await prisma.paymentTender.findMany({
    where: { method: "cash", transaction: { registerSessionId: sessionId } },
  });
  const cashSales = cashTenders.reduce((sum, t) => sum + Number(t.amount), 0);

  const movements = await prisma.cashMovement.findMany({ where: { sessionId } });
  const cashIn = movements.filter((m) => m.type === "in").reduce((sum, m) => sum + Number(m.amount), 0);
  const cashOut = movements.filter((m) => m.type === "out").reduce((sum, m) => sum + Number(m.amount), 0);

  return Number(session.openingFloat) + cashSales + cashIn - cashOut;
}

export async function closeRegisterSession(params: {
  sessionId: string;
  closedById: string;
  closingCount: number;
  notes?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.registerSession.findUnique({ where: { id: params.sessionId } });
    if (!session || session.status !== "open") throw new NoOpenRegisterError();

    const expectedCash = await computeExpectedCash(params.sessionId);
    const cashDifference = Math.round((params.closingCount - expectedCash) * 100) / 100;

    return tx.registerSession.update({
      where: { id: params.sessionId },
      data: {
        status: "closed",
        closedById: params.closedById,
        closedAt: new Date(),
        closingCount: params.closingCount,
        expectedCash,
        cashDifference,
        notes: params.notes,
      },
    });
  }, TRANSACTION_OPTIONS);
}
