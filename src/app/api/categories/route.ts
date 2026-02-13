import { NextRequest } from "next/server";
import { asc } from "drizzle-orm";

import { db } from "@/db/connection";
import { categories } from "@/db/schema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const limit = clampInt(sp.get("limit"), 50, 1, 200);

    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.id))
      .limit(limit);

    return new Response(JSON.stringify({ categories: rows }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Categories error:", error);
    return new Response(
      JSON.stringify({ categories: [], error: "internal_error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
