import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAdminReportMonthly } from "@/db/queries/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return jsonNoStore({ items: [], error: "unauthorized" }, 401);
  }

  if (session.user.role !== "admin") {
    return jsonNoStore({ items: [], error: "forbidden" }, 403);
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonNoStore({ items: [], error: "validation_error" }, 400);
  }

  const items = await getAdminReportMonthly({ months: parsed.data.months });
  return jsonNoStore({ items });
}
