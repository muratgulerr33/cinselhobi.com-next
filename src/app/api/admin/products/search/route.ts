import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getProductsByIdsPreserveOrder,
  searchProductsForCrossSell,
} from "@/db/queries/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(20, parsed));
}

function parsePositiveInt(value: string | null): number | undefined {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseIds(idsParam: string | null): number[] {
  if (!idsParam) return [];

  const parsedIds: number[] = [];
  const seen = new Set<number>();

  for (const token of idsParam.split(",")) {
    const id = Number.parseInt(token.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    parsedIds.push(id);
    if (parsedIds.length >= 50) break;
  }

  return parsedIds;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { items: [], error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { items: [], error: "forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const ids = parseIds(searchParams.get("ids"));

    if (ids.length > 0) {
      const items = await getProductsByIdsPreserveOrder(ids);
      return NextResponse.json(
        { items },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const q = (searchParams.get("q") ?? "").trim();
    if (!q) {
      return NextResponse.json(
        { items: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const limit = parseLimit(searchParams.get("limit"));
    const excludeProductId = parsePositiveInt(searchParams.get("excludeProductId"));
    const items = await searchProductsForCrossSell(q, limit, excludeProductId);

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Admin product search error:", error);
    return NextResponse.json(
      { items: [], error: "internal_error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
