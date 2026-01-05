import { join, resolve, normalize, dirname } from "path";
import { readFileSync, statSync } from "fs";
import { fileURLToPath } from "url";

/**
 * Güvenlik modülü: Path validation, allowlist, blocklist, secret masking
 */

// ES modules için __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Proje root dizini (bir üst dizin)
const PROJECT_ROOT = resolve(join(__dirname, "..", ".."));
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// İzin verilen text uzantıları
const ALLOWED_EXTENSIONS = [
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".txt",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".xml",
  ".sql",
  ".sh",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
];

// Blocklist: Okunamayacak dosya/klasör pattern'leri
const BLOCKLIST_PATTERNS = [
  /\.env/,
  /node_modules/,
  /\.git/,
  /data\/snapshots/,
  /\.next/,
  /dist/,
  /build/,
  /\.cache/,
  /coverage/,
  /\.DS_Store/,
  /\.log$/,
  /\.lock$/,
];

// Secret pattern'leri (masking için)
const SECRET_PATTERNS = [
  /(password|passwd|pwd)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  /(api[_-]?key|apikey)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  /(secret|token|auth[_-]?token)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  /(consumer[_-]?key|consumer[_-]?secret)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  /(database[_-]?url|db[_-]?url)\s*[:=]\s*["']?([^"'\s]+)["']?/gi,
  /(DATABASE_URL|WOO_CONSUMER_KEY|WOO_CONSUMER_SECRET|AUTH_SECRET)\s*=\s*([^\s]+)/gi,
];

/**
 * Path traversal saldırılarını engelle
 */
export function validatePath(filePath: string): {
  valid: boolean;
  resolvedPath: string | null;
  error?: string;
} {
  try {
    // Normalize path ve resolve et
    const normalized = normalize(filePath);
    const resolved = resolve(PROJECT_ROOT, normalized);

    // Path traversal kontrolü: resolved path PROJECT_ROOT içinde olmalı
    if (!resolved.startsWith(PROJECT_ROOT + "/") && resolved !== PROJECT_ROOT) {
      return {
        valid: false,
        resolvedPath: null,
        error: "Path traversal detected: path must be within project root",
      };
    }

    // Blocklist kontrolü
    const relativePath = resolved.replace(PROJECT_ROOT + "/", "");
    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(relativePath)) {
        return {
          valid: false,
          resolvedPath: null,
          error: `Blocked path pattern: ${relativePath}`,
        };
      }
    }

    return {
      valid: true,
      resolvedPath: resolved,
    };
  } catch (error) {
    return {
      valid: false,
      resolvedPath: null,
      error: `Path validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Dosya uzantısı kontrolü
 */
export function isAllowedExtension(filePath: string): boolean {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Dosya boyutu kontrolü
 */
export function checkFileSize(filePath: string): {
  valid: boolean;
  size: number;
  error?: string;
} {
  try {
    const stats = statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        size: stats.size,
        error: `File size ${stats.size} exceeds maximum ${MAX_FILE_SIZE}`,
      };
    }
    return {
      valid: true,
      size: stats.size,
    };
  } catch (error) {
    return {
      valid: false,
      size: 0,
      error: `Cannot read file stats: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Secret'ları mask'le
 */
export function maskSecrets(content: string): string {
  let masked = content;
  for (const pattern of SECRET_PATTERNS) {
    masked = masked.replace(pattern, (match, key, value) => {
      if (value && value.length > 0) {
        const maskedValue =
          value.length > 8
            ? value.substring(0, 4) + "***" + value.substring(value.length - 4)
            : "***";
        return `${key}=${maskedValue}`;
      }
      return match;
    });
  }
  return masked;
}

/**
 * Log'lardan secret'ları temizle
 */
export function sanitizeForLog(message: string): string {
  return maskSecrets(message);
}

/**
 * Güvenli dosya okuma: tüm kontrolleri yap
 */
export function safeReadFile(filePath: string): {
  success: boolean;
  content?: string;
  error?: string;
} {
  // Path validation
  const pathValidation = validatePath(filePath);
  if (!pathValidation.valid || !pathValidation.resolvedPath) {
    return {
      success: false,
      error: pathValidation.error || "Invalid path",
    };
  }

  const resolvedPath = pathValidation.resolvedPath;

  // Extension check
  if (!isAllowedExtension(resolvedPath)) {
    return {
      success: false,
      error: "File extension not allowed. Only text files are permitted.",
    };
  }

  // File size check
  const sizeCheck = checkFileSize(resolvedPath);
  if (!sizeCheck.valid) {
    return {
      success: false,
      error: sizeCheck.error || "File size check failed",
    };
  }

  // Read file
  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const maskedContent = maskSecrets(content);
    return {
      success: true,
      content: maskedContent,
    };
  } catch (error) {
    return {
      success: false,
      error: `Cannot read file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export { PROJECT_ROOT };

