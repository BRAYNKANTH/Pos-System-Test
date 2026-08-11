import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { apiSuccess, apiError } from "@/lib/api-response";

// GET /api/admin/locations — list business locations. Any authenticated
// user with LOCATION_VIEW can read the list (needed for the location
// picker on Add Purchase / Stock Transfer), only LOCATION_MANAGE can
// create/edit/delete.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.LOCATION_VIEW))) {
    return apiError("FORBIDDEN", "Not allowed to view locations", { status: 403 });
  }

  const locations = await prisma.location.findMany({ orderBy: { createdAt: "asc" } });
  return apiSuccess(locations);
}

// POST /api/admin/locations — create a new branch/outlet.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Login required", { status: 401 });
  if (!(await checkPermission(user.role, PERMISSIONS.LOCATION_MANAGE))) {
    return apiError("FORBIDDEN", "Not allowed to manage locations", { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const city = typeof body?.city === "string" && body.city.trim() ? body.city.trim() : undefined;
  const country = typeof body?.country === "string" && body.country.trim() ? body.country.trim() : undefined;
  const landmark = typeof body?.landmark === "string" && body.landmark.trim() ? body.landmark.trim() : undefined;

  if (!name || !code) {
    return apiError("INVALID_INPUT", "name and a unique code are required", { status: 400 });
  }

  try {
    const location = await prisma.location.create({
      data: { name, code, city, country, landmark },
    });
    return apiSuccess(location, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return apiError("DUPLICATE_CODE", `Location code "${code}" already exists`, { status: 409 });
    }
    console.error("Failed to create location", err);
    return apiError("CREATE_FAILED", "Failed to create location", { status: 500 });
  }
}
