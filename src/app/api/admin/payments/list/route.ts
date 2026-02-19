import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  ADMIN_PAYMENT_METHOD_FILTERS,
  ADMIN_PAYMENT_STATUS_FILTERS,
  listAdminPayments,
} from "@/db/queries/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  method: z.enum(ADMIN_PAYMENT_METHOD_FILTERS).default("all"),
  status: z.enum(ADMIN_PAYMENT_STATUS_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  datePreset: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseDateInput(value: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function resolveDateRange(input: z.infer<typeof querySchema>): { dateFrom?: Date; dateTo?: Date; error?: string } {
  if (input.datePreset === "custom") {
    const from = input.dateFrom ? parseDateInput(input.dateFrom) : null;
    const to = input.dateTo ? parseDateInput(input.dateTo) : null;
    if (!from || !to) {
      return {
        error: "custom_range_requires_start_end",
      };
    }
    if (from.getTime() > to.getTime()) {
      return {
        error: "custom_range_start_after_end",
      };
    }

    return {
      dateFrom: startOfDay(from),
      dateTo: endOfDay(to),
    };
  }

  const now = new Date();
  const dayCount = input.datePreset === "7d" ? 7 : input.datePreset === "90d" ? 90 : 30;
  const rangeStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayCount - 1)));
  return {
    dateFrom: rangeStart,
    dateTo: endOfDay(now),
  };
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

  const dateRange = resolveDateRange(parsed.data);
  if (dateRange.error) {
    return jsonNoStore({ items: [], error: dateRange.error }, 400);
  }
  const result = await listAdminPayments({
    q: parsed.data.q,
    method: parsed.data.method,
    status: parsed.data.status,
    page: parsed.data.page,
    limit: parsed.data.limit,
    dateFrom: dateRange.dateFrom,
    dateTo: dateRange.dateTo,
  });

  return jsonNoStore(result);
}
