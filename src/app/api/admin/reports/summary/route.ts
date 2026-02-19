import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAdminReportSummary } from "@/db/queries/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
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
    return jsonNoStore({ error: "unauthorized" }, 401);
  }

  if (session.user.role !== "admin") {
    return jsonNoStore({ error: "forbidden" }, 403);
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonNoStore({ error: "validation_error" }, 400);
  }

  const result = await getAdminReportSummary({ month: parsed.data.month });
  return jsonNoStore(result);
}
