import { pgTable, serial, integer, text, timestamp, jsonb, primaryKey, boolean, index, pgEnum, numeric, uuid } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  wcId: integer("wc_id").unique().notNull(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  parentWcId: integer("parent_wc_id"),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  wcId: integer("wc_id").unique().notNull(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  type: text("type").notNull(),
  sku: text("sku"),
  price: integer("price"),
  regularPrice: integer("regular_price"),
  salePrice: integer("sale_price"),
  currency: text("currency").default("TRY").notNull(),
  shortDescription: text("short_description"),
  description: text("description"),
  stockStatus: text("stock_status"),
  stockQuantity: integer("stock_quantity"),
  images: jsonb("images"),
  raw: jsonb("raw").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  wcIdDescIdx: index("products_wc_id_desc_idx").on(table.wcId),
}));

export const productCategories = pgTable(
  "product_categories",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.productId, table.categoryId] }),
  })
);

// Auth.js v5 tabloları
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"), // Credentials provider için - Argon2 hash
  role: text("role").$type<"admin" | "user">().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

export const userFavorites = pgTable(
  "user_favorites",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.productId] }),
  })
);

export const userAddresses = pgTable("user_addresses", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fullAddress: text("full_address").notNull(),
  city: text("city").notNull(),
  district: text("district").notNull(),
  phone: text("phone").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderStatusEnum = pgEnum("order_status", ["pending", "processing", "shipped", "delivered", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["credit_card", "cod"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "failed", "refunded", "cancelled"]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  addressId: integer("address_id")
    .notNull()
    .references(() => userAddresses.id, { onDelete: "restrict" }),
  status: orderStatusEnum("status").default("pending").notNull(),
  totalAmount: integer("total_amount").notNull(), // kuruş cinsinden
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").default("pending"),
  paymentTransactionId: text("payment_transaction_id"),
  paymentProvider: text("payment_provider"),
  paymentMetadata: jsonb("payment_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(), // kuruş cinsinden - o anki satış fiyatı
});

