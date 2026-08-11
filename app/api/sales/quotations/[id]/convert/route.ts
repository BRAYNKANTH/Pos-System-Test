import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";
import { convertQuotation, QuotationNotFoundError, QuotationNotConvertibleError } from "@/lib/sales/quotations";

// POST /api/sales/quotations/:id/convert — marks the quotation converted
// and hands its items back for the client to load into the POS cart.
// Doesn't create a Transaction itself — the actual sale still goes
// through real checkout (stock deduction, payment) once the cashier
// completes it from /pos.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.QUOTATION_CREATE))) {
    return apiError("FORBIDDEN", "Not allowed to convert quotations", { status: 403 });
  }

  const { id } = await params;
  try {
    const quotation = await convertQuotation(id);
    return apiSuccess(quotation);
  } catch (err) {
    if (err instanceof QuotationNotFoundError) {
      return apiError("NOT_FOUND", err.message, { status: 404 });
    }
    if (err instanceof QuotationNotConvertibleError) {
      return apiError("NOT_CONVERTIBLE", err.message, { status: 409 });
    }
    console.error("convertQuotation failed", err);
    return apiError("CONVERT_FAILED", "Failed to convert quotation", { status: 500 });
  }
}
