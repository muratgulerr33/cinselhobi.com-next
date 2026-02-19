// src/lib/uploads.ts
import path from "node:path";

const PROD_UPLOADS_DIR = "/data/uploads";

function validateSegments(segments: string[]) {
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new Error("Invalid uploads path segment");
    }

    if (seg.includes("\0")) {
      throw new Error("Invalid uploads path segment");
    }

    if (seg.includes("/") || seg.includes("\\")) {
      throw new Error("Invalid uploads path segment");
    }
  }
}

function normalizePublicFilename(filename: string): string {
  const normalized = filename.trim().replace(/\\/g, "/");
  if (!normalized) {
    throw new Error("Invalid upload filename");
  }

  if (normalized.includes("\0")) {
    throw new Error("Invalid upload filename");
  }

  const parts = normalized.split("/");
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error("Invalid upload filename");
  }

  const basename = path.posix.basename(normalized);
  if (!basename || basename === "." || basename === "..") {
    throw new Error("Invalid upload filename");
  }

  return basename;
}

export function getUploadsDir(): string {
  const envDir = (process.env.UPLOADS_DIR ?? "").trim();
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }

  if (process.env.NODE_ENV === "production") return PROD_UPLOADS_DIR;
  return path.resolve(process.cwd(), ".data", "uploads");
}

/**
 * Resolve absolute filesystem path under uploads root from pre-split path segments.
 */
export function resolveUploadsPath(segments: string[]): string {
  validateSegments(segments);

  const uploadsDir = getUploadsDir();
  const root = path.resolve(uploadsDir);
  const abs = path.join(uploadsDir, ...segments);
  const resolved = path.resolve(abs);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Resolved uploads path escapes root");
  }

  return resolved;
}

export function getProductUploadsDir(productId: number | string): string {
  return resolveUploadsPath(["products", String(productId)]);
}

export function toProductUploadPublicPath(productId: number | string, filename: string): string {
  const safeName = normalizePublicFilename(filename);
  return `/uploads/products/${String(productId)}/${safeName}`;
}
