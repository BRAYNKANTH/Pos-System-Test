import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createQuotation } from "@/lib/sales/quotations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.QUOTATION_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view quotations", { status: 403 });
  }

  const quotations = await prisma.quotation.findMany({
    include: { items: true, customer: true, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return apiSuccess(quotations);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.QUOTATION_CREATE))) {
    return apiError("FORBIDDEN", "Not allowed to create quotations", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const customerId = typeof body?.customerId === "string" && body.customerId ? body.customerId : null;
  const items = Array.isArray(body?.items)
    ? body.items
        .map((i: { sku?: unknown; name?: unknown; qty?: unknown; unitPrice?: unknown }) => ({
          sku: String(i?.sku ?? ""),
          name: String(i?.name ?? ""),
          qty: Number(i?.qty),
          unitPrice: Number(i?.unitPrice),
        }))
        .filter(
          (i: { sku: string; name: string; qty: number; unitPrice: number }) =>
            i.sku && i.qty > 0 && Number.isFinite(i.unitPrice) && i.unitPrice >= 0,
        )
    : [];
  const discount = Number(body?.discount) || 0;
  const validUntil = typeof body?.validUntil === "string" && body.validUntil ? new Date(body.validUntil) : null;

  if (items.length === 0) {
    return apiError("INVALID_INPUT", "At least one valid line item is required", { status: 400 });
  }

  const quotation = await createQuotation({ customerId, items, discount, validUntil, createdById: user.id });
  return apiSuccess(quotation, { status: 201 });
}
