import { db } from "@/db/connection";
import { orders, orderItems, products, users, userAddresses } from "@/db/schema";
import { eq, desc, and, count, sum, ilike, or, lt, type SQL } from "drizzle-orm";

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
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  totalAmount: number;
  paymentMethod: "credit_card" | "cod";
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export async function getAllOrders(): Promise<AdminOrderListItem[]> {
  const result = await db
    .select({
      id: orders.id,
      userId: orders.userId,
      status: orders.status,
      totalAmount: orders.totalAmount,
      paymentMethod: orders.paymentMethod,
      createdAt: orders.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt));

  return result;
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
