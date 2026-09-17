import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { apiSuccess, apiError } from "@/lib/api-response";
import { quoteSchema, quoteSale } from "@/lib/pos/quote";
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('UNAUTHENTICATED', 'Login required', { status: 401 });
  const parsed = quoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError('INVALID_INPUT', parsed.error.issues[0].message, { status: 400 });
  try { return apiSuccess((await quoteSale(parsed.data, user.role)).calculation); }
  catch (e) { return apiError('QUOTE_FAILED', e instanceof Error ? e.message : 'Could not price the sale', { status: 400 }); }
}
