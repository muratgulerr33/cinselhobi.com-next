import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { listAdminCustomers } from "@/db/queries/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
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

  const result = await listAdminCustomers({
    q: parsed.data.q,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return jsonNoStore(result);
}
