import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq, inArray, sql } from "drizzle-orm";
import { categories, products, productCategories } from "../../src/db/schema";

const TARGET_CATEGORY_SLUG = "masaj-yaglari";
const PRODUCT_SLUGS = [
  "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml",
  "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-400-ml",
  "bona-tessa-su-bazli-kayganlastirici-masaj-jeli-250-ml-cilekli",
  "cabs-bona-tessa-gel-vanilyali-250-ml",
];

async function main() {
  dotenv.config({ path: ".env.local" });
  dotenv.config();

  const url = process.env.DATABASE_URL;
  if (!url || typeof url !== "string") {
    throw new Error("DATABASE_URL is missing. Set it in .env.local (or .env).");
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    const categoryRows = await db
      .select({
        id: categories.id,
        wcId: categories.wcId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(categories)
      .where(eq(categories.slug, TARGET_CATEGORY_SLUG))
      .limit(1);

    const category = categoryRows[0] ?? null;

    const productRows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        stockStatus: products.stockStatus,
      })
      .from(products)
      .where(inArray(products.slug, PRODUCT_SLUGS));

    const foundSlugSet = new Set(productRows.map((p) => p.slug));
    const missingSlugs = PRODUCT_SLUGS.filter((slug) => !foundSlugSet.has(slug));

    let existingLinks: Array<{ productId: number }> = [];
    if (category && productRows.length > 0) {
      existingLinks = await db
        .select({ productId: productCategories.productId })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.categoryId, category.id),
            inArray(productCategories.productId, productRows.map((p) => p.id))
          )
        );
    }

    const existingLinkSet = new Set(existingLinks.map((link) => link.productId));
    const linksToInsert = category
      ? productRows
          .filter((product) => !existingLinkSet.has(product.id))
          .map((product) => ({
            productId: product.id,
            categoryId: category.id,
          }))
      : [];

    console.table([
      {
        metric: "categoryFound",
        value: category ? "yes" : "no",
        details: category ? `id=${category.id} wcId=${category.wcId}` : "missing",
      },
      {
        metric: "foundProducts",
        value: `${productRows.length}`,
        details: `expected=${PRODUCT_SLUGS.length}`,
      },
      {
        metric: "missingProducts",
        value: `${missingSlugs.length}`,
        details: missingSlugs.length ? missingSlugs.join(", ") : "-",
      },
      {
        metric: "existingLinks",
        value: `${existingLinks.length}`,
        details: category ? `categoryId=${category.id}` : "category missing",
      },
      {
        metric: "linksToInsert",
        value: `${linksToInsert.length}`,
        details: category ? `categoryId=${category.id}` : "category missing",
      },
    ]);

    console.table(
      productRows.map((product) => ({
        id: product.id,
        slug: product.slug,
        stockStatus: product.stockStatus ?? "unknown",
        inStock: product.stockStatus === "instock",
      }))
    );

    if (!category) {
      console.error("Category not found. Aborting without changes.");
      return;
    }

    if (productRows.length === 0) {
      console.error("No products found. Aborting without changes.");
      return;
    }

    if (linksToInsert.length > 0) {
      await db.insert(productCategories).values(linksToInsert).onConflictDoNothing();
    }

    const afterCountRows = await db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.categoryId, category.id),
          inArray(productCategories.productId, productRows.map((p) => p.id))
        )
      );
    const afterCount = Number(afterCountRows[0]?.count ?? 0);
    const beforeCount = existingLinks.length;
    const inserted = afterCount - beforeCount;

    console.table([
      { metric: "beforeCount", value: beforeCount },
      { metric: "attemptedInsert", value: linksToInsert.length },
      { metric: "afterCount", value: afterCount },
      { metric: "inserted", value: inserted },
    ]);

    const outOfStock = productRows.filter((p) => p.stockStatus !== "instock");
    if (outOfStock.length > 0) {
      console.warn(
        "Warning: some products are not instock. The drawer uses inStock=1 and may still be empty."
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exitCode = 1;
});
