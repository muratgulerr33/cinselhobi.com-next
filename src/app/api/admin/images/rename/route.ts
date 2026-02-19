import { promises as fs } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/connection";
import { products } from "@/db/schema";
import { resolveUploadsPath, toProductUploadPublicPath } from "@/lib/uploads";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const renameSchema = z.object({
  productId: z.number().int().positive(),
  fromPath: z.string().trim().min(1),
  newLabel: z.string().trim().min(1),
  productSlug: z.string().trim().optional(),
});

type ImageEntry = { src: string; alt: string | null };

class RenameError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function toApiError(error: unknown): RenameError {
  if (error instanceof RenameError) {
    return error;
  }

  return new RenameError(500, "internal_error", "Görsel yeniden adlandırılırken hata oluştu");
}

function sanitizeSlugSegment(input: string | undefined): string {
  const source = (input ?? "").trim();
  if (!source) return "";

  const map: Record<string, string> = {
    "ı": "i",
    "İ": "i",
    "ş": "s",
    "Ş": "s",
    "ğ": "g",
    "Ğ": "g",
    "ü": "u",
    "Ü": "u",
    "ö": "o",
    "Ö": "o",
    "ç": "c",
    "Ç": "c",
  };

  return source
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeImages(images: unknown): ImageEntry[] {
  if (!Array.isArray(images)) {
    return [];
  }

  const normalized: ImageEntry[] = [];

  for (const item of images) {
    if (typeof item === "string") {
      const src = item.trim();
      if (src) {
        normalized.push({ src, alt: null });
      }
      continue;
    }

    if (typeof item !== "object" || item === null) {
      continue;
    }

    const src = "src" in item && typeof item.src === "string"
      ? item.src.trim()
      : "";

    if (!src) {
      continue;
    }

    const alt = "alt" in item && typeof item.alt === "string"
      ? item.alt.trim() || null
      : null;

    normalized.push({ src, alt });
  }

  return normalized;
}

function parseUploadPath(fromPath: string, productId: number): string {
  const match = fromPath.match(/^\/uploads\/products\/(\d+)\/([^/?#]+)$/i);
  if (!match) {
    throw new RenameError(400, "invalid_path", "Yol yalnızca ürün upload klasörü altında olmalıdır");
  }

  const pathProductId = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(pathProductId) || pathProductId !== productId) {
    throw new RenameError(400, "invalid_path", "Yol ürün kimliği ile eşleşmiyor");
  }

  const filename = match[2] ?? "";
  if (!/^[a-z0-9][a-z0-9._-]*\.webp$/i.test(filename) || filename.includes("..")) {
    throw new RenameError(400, "invalid_path", "Geçersiz dosya adı");
  }

  return filename;
}

function resolveProductFilePath(productId: number, filename: string): string {
  const resolvedPath = resolveUploadsPath(["products", String(productId), filename]);
  if (!resolvedPath) {
    throw new RenameError(400, "invalid_path", "Dosya yolu çözümlenemedi");
  }
  return resolvedPath;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function resolveTargetFilename(
  productId: number,
  oldAbsolutePath: string,
  filenameBase: string
): Promise<{ filename: string; absolutePath: string; publicPath: string }> {
  let suffix = 1;

  while (suffix < 10_000) {
    const filename = suffix === 1
      ? `${filenameBase}.webp`
      : `${filenameBase}-${suffix}.webp`;
    const absolutePath = resolveProductFilePath(productId, filename);
    const publicPath = toProductUploadPublicPath(productId, filename);

    if (absolutePath === oldAbsolutePath) {
      return { filename, absolutePath, publicPath };
    }

    const exists = await pathExists(absolutePath);
    if (!exists) {
      return { filename, absolutePath, publicPath };
    }

    suffix += 1;
  }

  throw new RenameError(500, "filename_exhausted", "Yeni dosya adı üretilemedi");
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return jsonNoStore({ ok: false, error: "unauthorized", code: "unauthorized" }, 401);
  }

  if (session.user.role !== "admin") {
    return jsonNoStore({ ok: false, error: "forbidden", code: "forbidden" }, 403);
  }

  try {
    const body = await request.json();
    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      return jsonNoStore(
        { ok: false, error: "Geçersiz istek", code: "validation_error" },
        400
      );
    }

    const { productId, fromPath, newLabel, productSlug } = parsed.data;
    const [product] = await db
      .select({
        id: products.id,
        slug: products.slug,
        images: products.images,
        raw: products.raw,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return jsonNoStore(
        { ok: false, error: "Ürün bulunamadı", code: "product_not_found" },
        400
      );
    }

    const sourceFilename = parseUploadPath(fromPath, productId);
    const oldAbsolutePath = resolveProductFilePath(productId, sourceFilename);

    const safeLabel = sanitizeSlugSegment(newLabel);
    if (!safeLabel) {
      return jsonNoStore(
        { ok: false, error: "Geçerli bir etiket girin", code: "validation_error" },
        400
      );
    }

    const safeBaseSlug = sanitizeSlugSegment(productSlug) || sanitizeSlugSegment(product.slug) || "image";
    const targetBase = `${safeBaseSlug}-${safeLabel}`;
    const target = await resolveTargetFilename(productId, oldAbsolutePath, targetBase);
    const newPath = target.publicPath;

    const nextImages = normalizeImages(product.images);
    let hasMatch = false;
    const updatedImages = nextImages.map((entry) => {
      if (entry.src === fromPath) {
        hasMatch = true;
        return { ...entry, src: newPath };
      }
      return entry;
    });

    if (!hasMatch) {
      return jsonNoStore(
        { ok: false, error: "Kaynak görsel ürün kayıtlarında bulunamadı", code: "not_found" },
        400
      );
    }

    if (newPath === fromPath) {
      return jsonNoStore({ ok: true, path: newPath });
    }

    let sourceStat;
    try {
      sourceStat = await fs.stat(oldAbsolutePath);
    } catch {
      return jsonNoStore(
        { ok: false, error: "Kaynak dosya bulunamadı", code: "file_not_found" },
        400
      );
    }

    if (!sourceStat.isFile()) {
      return jsonNoStore(
        { ok: false, error: "Kaynak dosya bulunamadı", code: "file_not_found" },
        400
      );
    }

    try {
      await fs.rename(oldAbsolutePath, target.absolutePath);
    } catch {
      return jsonNoStore(
        { ok: false, error: "Dosya yeniden adlandırılamadı", code: "rename_failed" },
        500
      );
    }

    const rawObject = typeof product.raw === "object" && product.raw !== null && !Array.isArray(product.raw)
      ? (product.raw as Record<string, unknown>)
      : null;

    try {
      if (rawObject) {
        await db
          .update(products)
          .set({
            images: updatedImages,
            raw: {
              ...rawObject,
              images: updatedImages,
            },
            updatedAt: sql`now()`,
          })
          .where(eq(products.id, product.id));
      } else {
        await db
          .update(products)
          .set({
            images: updatedImages,
            updatedAt: sql`now()`,
          })
          .where(eq(products.id, product.id));
      }
    } catch (error) {
      await fs.rename(target.absolutePath, oldAbsolutePath).catch(() => undefined);
      throw error;
    }

    return jsonNoStore({ ok: true, path: newPath });
  } catch (error) {
    const apiError = toApiError(error);
    return jsonNoStore(
      { ok: false, error: apiError.message, code: apiError.code },
      apiError.status
    );
  }
}
