import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/connection";
import { products } from "@/db/schema";
import {
  getProductUploadsDir,
  resolveUploadsPath,
  toProductUploadPublicPath,
} from "@/lib/uploads";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_FILENAME_COLLISION_ATTEMPTS = 999;
const COVER_LABELS = new Set(["", "kapak", "cover"]);

const blockedIpList = new net.BlockList();
blockedIpList.addSubnet("0.0.0.0", 8, "ipv4");
blockedIpList.addSubnet("10.0.0.0", 8, "ipv4");
blockedIpList.addSubnet("100.64.0.0", 10, "ipv4");
blockedIpList.addSubnet("127.0.0.0", 8, "ipv4");
blockedIpList.addSubnet("169.254.0.0", 16, "ipv4");
blockedIpList.addSubnet("172.16.0.0", 12, "ipv4");
blockedIpList.addSubnet("192.0.0.0", 24, "ipv4");
blockedIpList.addSubnet("192.168.0.0", 16, "ipv4");
blockedIpList.addSubnet("198.18.0.0", 15, "ipv4");
blockedIpList.addSubnet("224.0.0.0", 4, "ipv4");
blockedIpList.addAddress("::1", "ipv6");
blockedIpList.addAddress("::", "ipv6");
blockedIpList.addSubnet("fc00::", 7, "ipv6");
blockedIpList.addSubnet("fe80::", 10, "ipv6");
blockedIpList.addSubnet("ff00::", 8, "ipv6");

const importSchema = z.object({
  productId: z.number().int().positive(),
  imageUrl: z
    .string()
    .trim()
    .url("Geçerli bir URL girin")
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Sadece http/https URL desteklenir"),
  productSlug: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  label: z.string().trim().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

type ImageEntry = { src: string; alt: string | null };

class ImportError extends Error {
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

function toApiError(error: unknown): ImportError {
  if (error instanceof ImportError) {
    return error;
  }

  return new ImportError(500, "internal_error", "Görsel içe aktarılırken hata oluştu");
}

function isBlockedIp(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];
  const family = net.isIP(normalized);

  if (family === 4) {
    return blockedIpList.check(normalized, "ipv4");
  }

  if (family === 6) {
    if (normalized.startsWith("::ffff:")) {
      const mappedV4 = normalized.slice("::ffff:".length);
      if (net.isIP(mappedV4) === 4) {
        return blockedIpList.check(mappedV4, "ipv4");
      }
    }

    return blockedIpList.check(normalized, "ipv6");
  }

  return false;
}

async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new ImportError(400, "invalid_url", "Geçersiz görsel URL");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ImportError(400, "invalid_protocol", "Sadece http/https URL desteklenir");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new ImportError(400, "invalid_url", "Kimlik bilgisi içeren URL desteklenmez");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new ImportError(400, "ssrf_blocked", "Yerel ağ adreslerine erişim engellendi");
  }

  const literalIpFamily = net.isIP(hostname);
  if (literalIpFamily > 0 && isBlockedIp(hostname)) {
    throw new ImportError(400, "ssrf_blocked", "Özel ağ adreslerine erişim engellendi");
  }

  if (literalIpFamily > 0) {
    return parsedUrl;
  }

  let resolved: LookupAddress[];
  try {
    resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ImportError(400, "dns_lookup_failed", "Uzak sunucu çözümlenemedi");
  }

  if (resolved.length === 0) {
    throw new ImportError(400, "dns_lookup_failed", "Uzak sunucu çözümlenemedi");
  }

  for (const record of resolved) {
    if (isBlockedIp(record.address)) {
      throw new ImportError(400, "ssrf_blocked", "Özel ağ adreslerine erişim engellendi");
    }
  }

  return parsedUrl;
}

function isRedirectStatus(status: number): boolean {
  return status === 301
    || status === 302
    || status === 303
    || status === 307
    || status === 308;
}

async function readResponseWithCap(
  response: Response,
  maxBytes: number
): Promise<Buffer> {
  if (!response.body) {
    throw new ImportError(400, "download_failed", "Görsel içeriği boş");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    let readResult: ReadableStreamReadResult<Uint8Array>;
    try {
      readResult = await reader.read();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ImportError(504, "timeout", "İndirme zaman aşımına uğradı");
      }
      throw new ImportError(502, "download_failed", "Görsel akışı okunamadı");
    }

    if (readResult.done) {
      break;
    }

    const chunk = readResult.value;
    totalBytes += chunk.byteLength;

    if (totalBytes > maxBytes) {
      throw new ImportError(413, "payload_too_large", "Görsel boyutu 10MB sınırını aşıyor");
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

async function downloadRemoteImage(imageUrl: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let currentUrl = imageUrl;
  let redirectCount = 0;

  try {
    while (true) {
      const safeUrl = await assertSafeRemoteUrl(currentUrl);

      let response: Response;
      try {
        response = await fetch(safeUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "image/*,*/*;q=0.8",
          },
          cache: "no-store",
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new ImportError(504, "timeout", "İndirme zaman aşımına uğradı");
        }
        throw new ImportError(502, "download_failed", "Görsel indirilemedi");
      }

      if (isRedirectStatus(response.status)) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new ImportError(400, "too_many_redirects", "Çok fazla yönlendirme alındı");
        }

        const location = response.headers.get("location");
        if (!location) {
          throw new ImportError(400, "invalid_redirect", "Yönlendirme hedefi eksik");
        }

        currentUrl = new URL(location, safeUrl).toString();
        redirectCount += 1;
        continue;
      }

      if (!response.ok) {
        throw new ImportError(
          400,
          "download_failed",
          `Görsel indirilemedi (HTTP ${response.status})`
        );
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!contentType.startsWith("image/")) {
        throw new ImportError(415, "unsupported_media_type", "Kaynak içerik görsel değil");
      }

      const contentLengthRaw = response.headers.get("content-length");
      if (contentLengthRaw) {
        const contentLength = Number.parseInt(contentLengthRaw, 10);
        if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
          throw new ImportError(
            413,
            "payload_too_large",
            "Görsel boyutu 10MB sınırını aşıyor"
          );
        }
      }

      return readResponseWithCap(response, MAX_DOWNLOAD_BYTES);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeFilenameBase(input: string | undefined): string {
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

  const normalized = source
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized;
}

function normalizeLabel(input: string | undefined): string {
  return sanitizeFilenameBase(input);
}

function isCoverLabel(normalizedLabel: string): boolean {
  return COVER_LABELS.has(normalizedLabel);
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

async function processImage(inputBuffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(inputBuffer)
      .rotate()
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 75, effort: 4 })
      .toBuffer();
  } catch {
    throw new ImportError(415, "invalid_image", "Görsel işlenemedi");
  }
}

function isNodeError(
  error: unknown
): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

async function tryWriteFileAtomically(filePath: string, data: Buffer): Promise<boolean> {
  const dirPath = path.dirname(filePath);
  const tempPath = path.join(
    dirPath,
    `.${path.basename(filePath)}.${randomUUID()}.tmp`
  );

  await fs.writeFile(tempPath, data, { flag: "wx" });

  try {
    await fs.link(tempPath, filePath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "EEXIST") {
      return false;
    }
    throw error;
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

async function writeProcessedImage(
  productId: number,
  filenameBase: string,
  imageBuffer: Buffer
): Promise<{ filename: string; publicPath: string }> {
  const productDir = getProductUploadsDir(productId);
  await fs.mkdir(productDir, { recursive: true });

  const primaryFilename = `${filenameBase}.webp`;
  const primaryPath = resolveUploadsPath(["products", String(productId), primaryFilename]);
  const primaryWritten = await tryWriteFileAtomically(primaryPath, imageBuffer);
  if (primaryWritten) {
    return {
      filename: primaryFilename,
      publicPath: toProductUploadPublicPath(productId, primaryFilename),
    };
  }

  for (let index = 2; index <= MAX_FILENAME_COLLISION_ATTEMPTS; index += 1) {
    const filename = `${filenameBase}-${index}.webp`;
    const filePath = resolveUploadsPath(["products", String(productId), filename]);
    const written = await tryWriteFileAtomically(filePath, imageBuffer);

    if (written) {
      return {
        filename,
        publicPath: toProductUploadPublicPath(productId, filename),
      };
    }
  }

  throw new ImportError(409, "filename_exhausted", "Dosya adı üretilemedi");
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
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return jsonNoStore(
        { ok: false, error: "Geçersiz istek", code: "validation_error" },
        400
      );
    }

    const { productId, imageUrl, productSlug, slug, label, sortOrder } = parsed.data;
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

    const downloaded = await downloadRemoteImage(imageUrl);
    const processed = await processImage(downloaded);
    const normalizedLabel = normalizeLabel(label);
    const normalizedProductSlug = sanitizeFilenameBase(productSlug || slug || product.slug) || "image";
    const isCover = sortOrder === 0 || isCoverLabel(normalizedLabel);
    const filenameBase = isCover
      ? normalizedProductSlug
      : `${normalizedProductSlug}-${normalizedLabel}`;
    const { publicPath } = await writeProcessedImage(
      product.id,
      filenameBase,
      processed
    );

    const nextImages = normalizeImages(product.images);
    const nextEntry: ImageEntry = { src: publicPath, alt: null };

    if (typeof sortOrder === "number") {
      const insertIndex = Math.max(0, Math.min(sortOrder, nextImages.length));
      nextImages.splice(insertIndex, 0, nextEntry);
    } else {
      nextImages.push(nextEntry);
    }

    const rawObject = typeof product.raw === "object" && product.raw !== null && !Array.isArray(product.raw)
      ? (product.raw as Record<string, unknown>)
      : null;

    if (rawObject) {
      await db
        .update(products)
        .set({
          images: nextImages,
          raw: {
            ...rawObject,
            images: nextImages,
          },
          updatedAt: sql`now()`,
        })
        .where(eq(products.id, product.id));
    } else {
      await db
        .update(products)
        .set({
          images: nextImages,
          updatedAt: sql`now()`,
        })
        .where(eq(products.id, product.id));
    }

    return jsonNoStore({ ok: true, path: publicPath });
  } catch (error) {
    const apiError = toApiError(error);
    return jsonNoStore(
      { ok: false, error: apiError.message, code: apiError.code },
      apiError.status
    );
  }
}
