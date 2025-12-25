import { pgTable, serial, integer, text, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

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
});

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

