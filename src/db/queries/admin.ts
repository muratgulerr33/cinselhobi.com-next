import { db } from "@/db/connection";
import { orders, orderItems, products, users, userAddresses } from "@/db/schema";
import { eq, desc, and, count, sum, ilike, or, lt, inArray, ne, sql, type SQL, asc, gte, lte } from "drizzle-orm";

export type AdminOrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type AdminPaymentMethod = "credit_card" | "cod";
export type AdminPaymentStatus = "pending" | "paid" | "failed" | "refunded" | "cancelled";

export const ADMIN_PAYMENT_METHOD_FILTERS = ["all", "cod", "credit_card"] as const;
export type AdminPaymentMethodFilter = (typeof ADMIN_PAYMENT_METHOD_FILTERS)[number];

export const ADMIN_PAYMENT_STATUS_FILTERS = [
  "all",
  "pending",
  "paid",
  "failed",
  "refunded",
  "cancelled",
] as const;
export type AdminPaymentStatusFilter = (typeof ADMIN_PAYMENT_STATUS_FILTERS)[number];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function clampPage(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    return 1;
  }
  return value as number;
}

function clampLimit(value: number | undefined, fallback = 20, max = 100): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    return fallback;
  }
  return Math.min(value as number, max);
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function parseMonthKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearRaw, monthRaw] = value.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const monthIndex = Number.parseInt(monthRaw ?? "", 10) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}

function resolveMonthRange(month?: string): { monthKey: string; start: Date; end: Date } {
  const now = new Date();
  const fallbackStart = getMonthStart(now);

  const parsedStart = month ? parseMonthKey(month) : null;
  const start = parsedStart ?? fallbackStart;
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);

  return {
    monthKey: toMonthKey(start),
    start,
    end,
  };
}

export function getRecentMonthKeys(months = 12): string[] {
  const normalized = Math.max(1, Math.min(24, Number.isInteger(months) ? months : 12));
  const currentMonthStart = getMonthStart(new Date());
  const earliestMonthStart = new Date(
    currentMonthStart.getFullYear(),
    currentMonthStart.getMonth() - (normalized - 1),
    1,
    0,
    0,
    0,
    0
  );

  return Array.from({ length: normalized }, (_, index) => {
    const monthStart = new Date(
      earliestMonthStart.getFullYear(),
      earliestMonthStart.getMonth() + index,
      1,
      0,
      0,
      0,
      0
    );
    return toMonthKey(monthStart);
  });
}

export interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number; // kuruş cinsinden
}

export async function getAdminStats(): Promise<AdminStats> {
  // Toplam sipariş sayısı
  const [totalOrdersResult] = await db
    .select({ count: count() })
    .from(orders);

  // Bekleyen siparişler (pending)
  const [pendingOrdersResult] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.status, "pending"));

  // Toplam ciro (teslim edilenler - delivered)
  const [revenueResult] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(eq(orders.status, "delivered"));

  return {
    totalOrders: totalOrdersResult?.count || 0,
    pendingOrders: pendingOrdersResult?.count || 0,
    totalRevenue: Number(revenueResult?.total || 0),
  };
}

export interface AdminOrderListItem {
  id: string;
  userId: string;
  status: AdminOrderStatus;
  totalAmount: number;
  paymentMethod: AdminPaymentMethod;
  paymentStatus: AdminPaymentStatus | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export interface GetAllOrdersOptions {
  userId?: string;
}

export async function getAllOrders(options: GetAllOrdersOptions = {}): Promise<AdminOrderListItem[]> {
  const userId = options.userId?.trim();
  const where = userId ? eq(orders.userId, userId) : undefined;

  const result = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      totalAmount: orders.totalAmount,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      createdAt: orders.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(where)
    .orderBy(desc(orders.createdAt));

  return result;
}

export interface AdminDashboardSummary {
  todaysOrdersCount: number;
  last7DaysRevenue: number;
  pendingProcessingOrdersCount: number;
}

export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const sevenDaysAgoStart = startOfDay(addDays(now, -6));
  const pendingOrProcessing = or(eq(orders.status, "pending"), eq(orders.status, "processing"));

  const [todaysOrdersResult] = await db
    .select({ count: count() })
    .from(orders)
    .where(and(gte(orders.createdAt, todayStart), lt(orders.createdAt, tomorrowStart)));

  const [last7DaysRevenueResult] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(
      and(
        eq(orders.status, "delivered"),
        gte(orders.createdAt, sevenDaysAgoStart),
        lt(orders.createdAt, tomorrowStart)
      )
    );

  const [pendingProcessingOrdersResult] = await db
    .select({ count: count() })
    .from(orders)
    .where(pendingOrProcessing);

  return {
    todaysOrdersCount: todaysOrdersResult?.count ?? 0,
    last7DaysRevenue: Number(last7DaysRevenueResult?.total ?? 0),
    pendingProcessingOrdersCount: pendingProcessingOrdersResult?.count ?? 0,
  };
}

export interface AdminTopProductItem {
  productId: number;
  productName: string;
  productSlug: string;
  quantity: number;
  revenue: number;
}

export interface GetAdminTopProductsOptions {
  days?: number;
  limit?: number;
}

export async function getAdminTopProducts(
  options: GetAdminTopProductsOptions = {}
): Promise<AdminTopProductItem[]> {
  const days = Math.max(1, Math.min(90, Number.isInteger(options.days) ? (options.days as number) : 30));
  const limit = clampLimit(options.limit, 10, 50);
  const now = new Date();
  const rangeStart = startOfDay(addDays(now, -(days - 1)));
  const tomorrowStart = addDays(startOfDay(now), 1);
  const quantityExpr = sql<number>`coalesce(sum(${orderItems.quantity}), 0)`;
  const revenueExpr = sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price}), 0)`;

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      quantity: quantityExpr,
      revenue: revenueExpr,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        eq(orders.status, "delivered"),
        gte(orders.createdAt, rangeStart),
        lt(orders.createdAt, tomorrowStart)
      )
    )
    .groupBy(products.id, products.name, products.slug)
    .orderBy(desc(quantityExpr), desc(revenueExpr))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));
}

export interface AdminLowStockProductItem {
  productId: number;
  productName: string;
  productSlug: string;
  stockQuantity: number;
}

export interface GetAdminLowStockProductsOptions {
  threshold?: number;
  limit?: number;
}

export async function getAdminLowStockProducts(
  options: GetAdminLowStockProductsOptions = {}
): Promise<AdminLowStockProductItem[]> {
  const threshold = Number.isInteger(options.threshold) ? Math.max(0, options.threshold as number) : 5;
  const limit = clampLimit(options.limit, 20, 100);

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      stockQuantity: products.stockQuantity,
    })
    .from(products)
    .where(
      and(
        sql`${products.stockQuantity} is not null`,
        lte(products.stockQuantity, threshold)
      )
    )
    .orderBy(asc(products.stockQuantity), asc(products.updatedAt))
    .limit(limit);

  return rows
    .filter((row) => typeof row.stockQuantity === "number")
    .map((row) => ({
      productId: row.productId,
      productName: row.productName,
      productSlug: row.productSlug,
      stockQuantity: row.stockQuantity as number,
    }));
}

export interface AdminPaymentsListItem {
  orderId: string;
  userId: string;
  createdAt: Date;
  paymentMethod: AdminPaymentMethod;
  paymentStatus: AdminPaymentStatus | null;
  totalAmount: number;
  paymentTransactionId: string | null;
  paymentProvider: string | null;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
}

export interface ListAdminPaymentsOptions {
  q?: string;
  method?: AdminPaymentMethodFilter;
  status?: AdminPaymentStatusFilter;
  page?: number;
  limit?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AdminPaymentsListResult {
  items: AdminPaymentsListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function listAdminPayments(
  options: ListAdminPaymentsOptions = {}
): Promise<AdminPaymentsListResult> {
  const page = clampPage(options.page);
  const limit = clampLimit(options.limit, 20, 100);
  const offset = (page - 1) * limit;
  const whereParts: SQL[] = [];
  const q = (options.q ?? "").trim();
  const method = options.method ?? "all";
  const status = options.status ?? "all";

  if (method !== "all") {
    whereParts.push(eq(orders.paymentMethod, method));
  }

  if (status !== "all") {
    whereParts.push(eq(orders.paymentStatus, status));
  }

  if (options.dateFrom) {
    whereParts.push(gte(orders.createdAt, options.dateFrom));
  }

  if (options.dateTo) {
    whereParts.push(lte(orders.createdAt, options.dateTo));
  }

  if (q) {
    const like = `%${q}%`;
    const searchCondition = or(
      ilike(users.name, like),
      ilike(users.email, like),
      ilike(userAddresses.phone, like),
      ilike(orders.paymentTransactionId, like),
      sql`cast(${orders.id} as text) ilike ${like}`
    );
    if (searchCondition) {
      whereParts.push(searchCondition);
    }
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;

  const [countResult] = await db
    .select({ count: count() })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
    .where(where);

  const total = countResult?.count ?? 0;

  const rows = await db
    .select({
      orderId: orders.id,
      userId: orders.userId,
      createdAt: orders.createdAt,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      totalAmount: orders.totalAmount,
      paymentTransactionId: orders.paymentTransactionId,
      paymentProvider: orders.paymentProvider,
      customer: {
        name: users.name,
        email: users.email,
        phone: userAddresses.phone,
      },
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export interface AdminReportPaymentMethodSplitItem {
  method: AdminPaymentMethod;
  orderCount: number;
  totalAmount: number;
}

export interface AdminReportSummary {
  month: string;
  totalOrders: number;
  totalRevenue: number;
  totalOrderAmount: number;
  pendingProcessingOrders: number;
  paymentMethodSplit: AdminReportPaymentMethodSplitItem[];
}

export interface GetAdminReportSummaryOptions {
  month?: string;
}

export async function getAdminReportSummary(
  options: GetAdminReportSummaryOptions = {}
): Promise<AdminReportSummary> {
  const monthRange = resolveMonthRange(options.month);
  const monthWhere = and(
    gte(orders.createdAt, monthRange.start),
    lt(orders.createdAt, monthRange.end)
  );
  const pendingOrProcessing = or(eq(orders.status, "pending"), eq(orders.status, "processing"));

  const [totalOrdersResult] = await db
    .select({ count: count() })
    .from(orders)
    .where(monthWhere);

  const [revenueResult] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(and(monthWhere, eq(orders.status, "delivered")));

  const [totalOrderAmountResult] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(monthWhere);

  const [pendingProcessingResult] = await db
    .select({ count: count() })
    .from(orders)
    .where(and(monthWhere, pendingOrProcessing));

  const methodCountExpr = count();
  const methodTotalExpr = sql<number>`coalesce(sum(${orders.totalAmount}), 0)`;
  const methodSplitRows = await db
    .select({
      method: orders.paymentMethod,
      orderCount: methodCountExpr,
      totalAmount: methodTotalExpr,
    })
    .from(orders)
    .where(monthWhere)
    .groupBy(orders.paymentMethod)
    .orderBy(asc(orders.paymentMethod));

  return {
    month: monthRange.monthKey,
    totalOrders: totalOrdersResult?.count ?? 0,
    totalRevenue: Number(revenueResult?.total ?? 0),
    totalOrderAmount: Number(totalOrderAmountResult?.total ?? 0),
    pendingProcessingOrders: pendingProcessingResult?.count ?? 0,
    paymentMethodSplit: methodSplitRows.map((row) => ({
      method: row.method,
      orderCount: Number(row.orderCount ?? 0),
      totalAmount: Number(row.totalAmount ?? 0),
    })),
  };
}

export interface AdminMonthlySalesItem {
  month: string;
  orderCount: number;
  totalRevenue: number;
}

export interface GetAdminReportMonthlyOptions {
  months?: number;
}

export async function getAdminReportMonthly(
  options: GetAdminReportMonthlyOptions = {}
): Promise<AdminMonthlySalesItem[]> {
  const monthKeys = getRecentMonthKeys(options.months ?? 12);
  const firstMonth = parseMonthKey(monthKeys[0] ?? "");
  const lastMonth = parseMonthKey(monthKeys[monthKeys.length - 1] ?? "");
  if (!firstMonth || !lastMonth) {
    return [];
  }

  const endExclusive = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1, 0, 0, 0, 0);
  const monthBucketExpr = sql`date_trunc('month', ${orders.createdAt})`;
  const monthKeyExpr = sql<string>`to_char(${monthBucketExpr}, 'YYYY-MM')`;
  const totalRevenueExpr = sql<number>`coalesce(sum(${orders.totalAmount}), 0)`;

  const rows = await db
    .select({
      month: monthKeyExpr,
      orderCount: count(),
      totalRevenue: totalRevenueExpr,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "delivered"),
        gte(orders.createdAt, firstMonth),
        lt(orders.createdAt, endExclusive)
      )
    )
    .groupBy(monthBucketExpr)
    .orderBy(asc(monthBucketExpr));

  const rowMap = new Map(
    rows.map((row) => [
      row.month,
      {
        orderCount: Number(row.orderCount ?? 0),
        totalRevenue: Number(row.totalRevenue ?? 0),
      },
    ])
  );

  return monthKeys.map((month) => {
    const summary = rowMap.get(month);
    return {
      month,
      orderCount: summary?.orderCount ?? 0,
      totalRevenue: summary?.totalRevenue ?? 0,
    };
  });
}

export interface GetAdminReportProductsOptions {
  month?: string;
  limit?: number;
}

export async function getAdminReportProducts(
  options: GetAdminReportProductsOptions = {}
): Promise<AdminTopProductItem[]> {
  const monthRange = resolveMonthRange(options.month);
  const limit = clampLimit(options.limit, 20, 100);
  const quantityExpr = sql<number>`coalesce(sum(${orderItems.quantity}), 0)`;
  const revenueExpr = sql<number>`coalesce(sum(${orderItems.quantity} * ${orderItems.price}), 0)`;

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      quantity: quantityExpr,
      revenue: revenueExpr,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(
      and(
        eq(orders.status, "delivered"),
        gte(orders.createdAt, monthRange.start),
        lt(orders.createdAt, monthRange.end)
      )
    )
    .groupBy(products.id, products.name, products.slug)
    .orderBy(desc(quantityExpr), desc(revenueExpr))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity ?? 0),
    revenue: Number(row.revenue ?? 0),
  }));
}

export interface AdminCustomerListItem {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
}

export interface ListAdminCustomersOptions {
  q?: string;
  page?: number;
  limit?: number;
}

export interface AdminCustomersListResult {
  items: AdminCustomerListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function listAdminCustomers(
  options: ListAdminCustomersOptions = {}
): Promise<AdminCustomersListResult> {
  const page = clampPage(options.page);
  const limit = clampLimit(options.limit, 20, 100);
  const offset = (page - 1) * limit;
  const q = (options.q ?? "").trim();
  const whereParts: SQL[] = [];

  if (q) {
    const like = `%${q}%`;
    const searchCondition = or(
      ilike(users.name, like),
      ilike(users.email, like),
      ilike(userAddresses.phone, like)
    );
    if (searchCondition) {
      whereParts.push(searchCondition);
    }
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;
  const [countResult] = await db
    .select({
      count: sql<number>`count(distinct ${users.id})`,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
    .where(where);

  const totalOrdersExpr = count(orders.id);
  const totalSpentExpr = sql<number>`coalesce(sum(${orders.totalAmount}), 0)`;
  const lastOrderExpr = sql<Date | null>`max(${orders.createdAt})`;
  const phoneExpr = sql<string | null>`max(${userAddresses.phone})`;

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: phoneExpr,
      totalOrders: totalOrdersExpr,
      totalSpent: totalSpentExpr,
      lastOrderAt: lastOrderExpr,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .leftJoin(userAddresses, eq(orders.addressId, userAddresses.id))
    .where(where)
    .groupBy(users.id, users.name, users.email)
    .orderBy(desc(lastOrderExpr))
    .limit(limit)
    .offset(offset);

  const total = Number(countResult?.count ?? 0);

  return {
    items: rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      totalOrders: Number(row.totalOrders ?? 0),
      totalSpent: Number(row.totalSpent ?? 0),
      lastOrderAt: row.lastOrderAt,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export type AdminProductStockFilter = "all" | "instock" | "outofstock";
export const ADMIN_PRODUCT_LIMIT_OPTIONS = [25, 50, 100, 250, 500, 1000] as const;
export type AdminProductLimit = (typeof ADMIN_PRODUCT_LIMIT_OPTIONS)[number];
export const DEFAULT_ADMIN_PRODUCT_LIMIT: AdminProductLimit = 50;

const ADMIN_PRODUCT_LIMIT_SET = new Set<number>(ADMIN_PRODUCT_LIMIT_OPTIONS);

function normalizeAdminProductLimit(limit: number | undefined): AdminProductLimit {
  if (typeof limit === "number" && ADMIN_PRODUCT_LIMIT_SET.has(limit)) {
    return limit as AdminProductLimit;
  }
  return DEFAULT_ADMIN_PRODUCT_LIMIT;
}

export interface AdminProductsCursor {
  updatedAt: Date;
  id: number;
}

export interface GetAdminProductsOptions {
  q?: string;
  stock?: AdminProductStockFilter;
  limit?: number;
  cursor?: AdminProductsCursor;
}

export interface AdminProductListItem {
  id: number;
  name: string;
  slug: string;
  price: number | null;
  stockStatus: string | null;
  stockQuantity: number | null;
  images: unknown;
  crossSellIds: number[] | null;
  updatedAt: Date;
}

export interface AdminProductListResult {
  items: AdminProductListItem[];
  hasNext: boolean;
  nextCursor: AdminProductsCursor | null;
}

export async function adminListProducts(
  options: GetAdminProductsOptions = {}
): Promise<AdminProductListResult> {
  const q = (options.q ?? "").trim();
  const stock = (options.stock ?? "all") as AdminProductStockFilter;
  const limit = normalizeAdminProductLimit(options.limit);
  const fetchLimit = limit + 1;
  const whereParts: SQL[] = [];

  if (q) {
    const like = `%${q}%`;
    const nameOrSlug = or(ilike(products.name, like), ilike(products.slug, like));
    if (nameOrSlug) {
      whereParts.push(nameOrSlug);
    }
  }

  if (stock === "instock") whereParts.push(eq(products.stockStatus, "instock"));
  if (stock === "outofstock") whereParts.push(eq(products.stockStatus, "outofstock"));

  if (options.cursor) {
    const cursorCondition = or(
      lt(products.updatedAt, options.cursor.updatedAt),
      and(eq(products.updatedAt, options.cursor.updatedAt), lt(products.id, options.cursor.id))
    );
    if (cursorCondition) {
      whereParts.push(cursorCondition);
    }
  }

  const where = whereParts.length > 0 ? and(...whereParts) : undefined;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      stockStatus: products.stockStatus,
      stockQuantity: products.stockQuantity,
      images: products.images,
      crossSellIds: products.crossSellIds,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(where)
    .orderBy(desc(products.updatedAt), desc(products.id))
    .limit(fetchLimit);

  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];

  return {
    items,
    hasNext,
    nextCursor: hasNext && lastItem
      ? { updatedAt: lastItem.updatedAt, id: lastItem.id }
      : null,
  };
}

export const getAdminProducts = adminListProducts;

export interface AdminCrossSellProductItem {
  id: number;
  slug: string;
  name: string;
  price: number | null;
  salePrice: number | null;
  regularPrice: number | null;
  currency: string;
  images: unknown;
  stockStatus: string | null;
}

function clampCrossSellLimit(limit: number | undefined, fallback = 20): number {
  if (!Number.isInteger(limit)) return fallback;
  return Math.max(1, Math.min(20, limit as number));
}

function sanitizeCrossSellIds(ids: number[]): number[] {
  const normalized: number[] = [];
  const seen = new Set<number>();

  for (const rawId of ids) {
    if (!Number.isInteger(rawId) || rawId <= 0) continue;
    if (seen.has(rawId)) continue;
    seen.add(rawId);
    normalized.push(rawId);
  }

  return normalized;
}

export async function searchProductsForCrossSell(
  query: string,
  limit = 20,
  excludeProductId?: number
): Promise<AdminCrossSellProductItem[]> {
  const q = query.trim();
  if (!q) {
    return [];
  }

  const whereParts: SQL[] = [eq(products.status, "publish")];
  const like = `%${q}%`;
  const nameOrSlug = or(ilike(products.name, like), ilike(products.slug, like));
  if (nameOrSlug) {
    whereParts.push(nameOrSlug);
  }

  const excludedId = Number.isInteger(excludeProductId) && (excludeProductId ?? 0) > 0
    ? (excludeProductId as number)
    : undefined;
  if (excludedId !== undefined) {
    whereParts.push(ne(products.id, excludedId));
  }

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      price: products.price,
      salePrice: products.salePrice,
      regularPrice: products.regularPrice,
      currency: products.currency,
      images: products.images,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .where(and(...whereParts))
    .orderBy(desc(products.updatedAt), desc(products.id))
    .limit(clampCrossSellLimit(limit));

  return rows;
}

export async function getProductsByIdsPreserveOrder(
  ids: number[]
): Promise<AdminCrossSellProductItem[]> {
  const normalizedIds = sanitizeCrossSellIds(ids);
  if (normalizedIds.length === 0) {
    return [];
  }

  const idsArraySql = sql`ARRAY[${sql.join(
    normalizedIds.map((id) => sql`${id}`),
    sql`, `
  )}]::integer[]`;

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      price: products.price,
      salePrice: products.salePrice,
      regularPrice: products.regularPrice,
      currency: products.currency,
      images: products.images,
      stockStatus: products.stockStatus,
    })
    .from(products)
    .where(
      and(
        eq(products.status, "publish"),
        inArray(products.id, normalizedIds)
      )
    )
    .orderBy(sql`array_position(${idsArraySql}, ${products.id})`);

  return rows;
}

export interface AdminOrderDetail {
  id: string;
  userId: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  totalAmount: number;
  paymentMethod: "credit_card" | "cod";
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  address: {
    id: number;
    title: string;
    fullAddress: string;
    city: string;
    district: string;
    phone: string;
    isDefault: boolean;
  } | null;
  orderItems: Array<{
    id: string;
    productId: number;
    quantity: number;
    price: number;
    product: {
      id: number;
      name: string;
      slug: string;
      imageUrl: unknown;
    };
  }>;
}

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  // Sipariş bilgisini çek
  const [order] = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      totalAmount: orders.totalAmount,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
      addressId: orders.addressId,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return null;
  }

  // Adres bilgisini çek
  const [address] = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.id, order.addressId))
    .limit(1);

  // Sipariş ürünlerini çek
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      quantity: orderItems.quantity,
      price: orderItems.price,
      product: {
        id: products.id,
        name: products.name,
        slug: products.slug,
        imageUrl: products.images,
      },
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
    user: order.user,
    address: address || null,
    orderItems: items,
  };
}
