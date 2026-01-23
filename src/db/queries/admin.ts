import { db } from "@/db/connection";
import { orders, orderItems, products, users, userAddresses } from "@/db/schema";
import { eq, desc, and, count, sum, sql } from "drizzle-orm";

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

