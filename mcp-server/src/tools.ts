import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import {
  validatePath,
  safeReadFile,
  PROJECT_ROOT,
  sanitizeForLog,
} from "./security.js";

/**
 * MCP Tools: list_files, read_file, search_in_files
 */

export interface ToolResult {
  success: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
}

/**
 * list_files: Dizindeki dosyaları listele
 */
export async function listFiles(
  directory: string = "."
): Promise<ToolResult> {
  try {
    const pathValidation = validatePath(directory);
    if (!pathValidation.valid || !pathValidation.resolvedPath) {
      return {
        success: false,
        error: pathValidation.error || "Invalid directory path",
      };
    }

    const resolvedPath = pathValidation.resolvedPath;

    // Dizin kontrolü
    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        success: false,
        error: "Path is not a directory",
      };
    }

    const entries = readdirSync(resolvedPath, { withFileTypes: true });
    const files = entries
      .map((entry) => {
        const fullPath = join(resolvedPath, entry.name);
        const relPath = relative(PROJECT_ROOT, fullPath);
        return {
          name: entry.name,
          path: relPath,
          type: entry.isDirectory() ? "directory" : "file",
        };
      })
      .filter((entry) => {
        // Blocklist kontrolü
        const pathValidation = validatePath(entry.path);
        return pathValidation.valid;
      })
      .sort((a, b) => {
        // Önce dizinler, sonra dosyalar
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    return {
      success: true,
      data: {
        directory: relative(PROJECT_ROOT, resolvedPath),
        files,
        count: files.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeForLog(
        `Error listing files: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * read_file: Dosya içeriğini oku
 */
export async function readFile(filePath: string): Promise<ToolResult> {
  const result = safeReadFile(filePath);
  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  const pathValidation = validatePath(filePath);
  const relPath = pathValidation.resolvedPath
    ? relative(PROJECT_ROOT, pathValidation.resolvedPath)
    : filePath;

  return {
    success: true,
    data: {
      path: relPath,
      content: result.content,
      size: result.content?.length || 0,
    },
  };
}

/**
 * search_in_files: Dosyalarda metin ara
 */
export async function searchInFiles(
  query: string,
  directory: string = ".",
  maxResults: number = 50
): Promise<ToolResult> {
  try {
    const pathValidation = validatePath(directory);
    if (!pathValidation.valid || !pathValidation.resolvedPath) {
      return {
        success: false,
        error: pathValidation.error || "Invalid directory path",
      };
    }

    const resolvedPath = pathValidation.resolvedPath;
    const stats = statSync(resolvedPath);
    if (!stats.isDirectory()) {
      return {
        success: false,
        error: "Path is not a directory",
      };
    }

    const results: Array<{
      path: string;
      line: number;
      content: string;
    }> = [];

    function searchRecursive(dir: string, depth: number = 0): void {
      if (depth > 10 || results.length >= maxResults) {
        return; // Max depth ve max results kontrolü
      }

      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) break;

          const fullPath = join(dir, entry.name);
          const relPath = relative(PROJECT_ROOT, fullPath);

          // Blocklist kontrolü
          const pathValidation = validatePath(relPath);
          if (!pathValidation.valid) {
            continue;
          }

          if (entry.isDirectory()) {
            searchRecursive(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const readResult = safeReadFile(relPath);
            if (readResult.success && readResult.content) {
              const lines = readResult.content.split("\n");
              lines.forEach((line, index) => {
                if (
                  results.length < maxResults &&
                  line.toLowerCase().includes(query.toLowerCase())
                ) {
                  results.push({
                    path: relPath,
                    line: index + 1,
                    content: line.trim(),
                  });
                }
              });
            }
          }
        }
      } catch (error) {
        // Dizin okuma hatası, sessizce devam et
        console.error(
          sanitizeForLog(`Error reading directory ${dir}: ${error}`)
        );
      }
    }

    searchRecursive(resolvedPath);

    return {
      success: true,
      data: {
        query,
        directory: relative(PROJECT_ROOT, resolvedPath),
        results,
        count: results.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeForLog(
        `Error searching files: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}

/**
 * git_status: Git durumunu kontrol et (opsiyonel)
 */
export async function gitStatus(): Promise<ToolResult> {
  try {
    const { execSync } = await import("child_process");
    const status = execSync("git status --porcelain", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
    }).trim();

    return {
      success: true,
      data: {
        status: status || "Working tree clean",
        files: status
          ? status.split("\n").map((line) => line.trim())
          : [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeForLog(
        `Git status error: ${error instanceof Error ? error.message : String(error)}`
      ),
    };
  }
}




