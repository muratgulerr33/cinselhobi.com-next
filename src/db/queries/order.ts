import { db } from "@/db/connection";
import { orders, orderItems, products } from "@/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { userAddresses } from "@/db/schema";

export interface CreateOrderData {
  userId: string;
  addressId: number;
  paymentMethod: "credit_card" | "cod";
  items: Array<{
    productId: number;
    quantity: number;
  }>;
  // Payment alanları (opsiyonel)
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  paymentTransactionId?: string;
  paymentProvider?: string;
  paymentMetadata?: Record<string, unknown>;
}

export async function createOrder(data: CreateOrderData) {
  // Önce ürün fiyatlarını veritabanından çek
  const productIds = data.items.map((item) => item.productId);
  const productPrices = await db
    .select({
      id: products.id,
      price: products.price,
      salePrice: products.salePrice,
    })
    .from(products)
    .where(inArray(products.id, productIds));

  // Fiyat map'i oluştur
  const priceMap = new Map<number, number>();
  for (const p of productPrices) {
    // salePrice varsa onu kullan, yoksa price kullan
    const finalPrice = p.salePrice ?? p.price ?? 0;
    priceMap.set(p.id, finalPrice);
  }

  // Toplam tutarı hesapla
  let totalAmount = 0;
  for (const item of data.items) {
    const price = priceMap.get(item.productId);
    if (!price) {
      throw new Error(`Product ${item.productId} not found or has no price`);
    }
    totalAmount += price * item.quantity;
  }

  // Transaction ile order ve order_items oluştur
  return await db.transaction(async (tx) => {
    // Order oluştur
    const [order] = await tx
      .insert(orders)
      .values({
        userId: data.userId,
        addressId: data.addressId,
        paymentMethod: data.paymentMethod,
        totalAmount,
        status: "pending",
        paymentStatus: data.paymentStatus ?? "pending",
        paymentTransactionId: data.paymentTransactionId ?? null,
        paymentProvider: data.paymentProvider ?? null,
        paymentMetadata: data.paymentMetadata ?? null,
      })
      .returning();

    // Order items oluştur
    const itemsToInsert = data.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      price: priceMap.get(item.productId)!,
    }));

    await tx.insert(orderItems).values(itemsToInsert);

    return order;
  });
}

export async function getOrderById(orderId: string, userId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);

  return order || null;
}

export async function getOrdersByUserId(userId: string) {
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  return result;
}

export async function getUserOrders(userId: string) {
  // Önce siparişleri çek
  const ordersList = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

  // Her sipariş için orderItems ve products bilgilerini çek
  const ordersWithItems = await Promise.all(
    ordersList.map(async (order) => {
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
        .where(eq(orderItems.orderId, order.id));

      return {
        ...order,
        orderItems: items,
      };
    })
  );

  return ordersWithItems;
}

export async function getOrderItemsByOrderId(orderId: string) {
  const result = await db
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

  return result;
}

export async function getOrderDetails(orderId: string, userId: string) {
  // Sipariş bilgisini çek
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
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
    ...order,
    address: address || null,
    orderItems: items,
  };
}

