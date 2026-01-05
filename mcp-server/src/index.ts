import { createServer } from "http";
import { parse } from "url";
import { listFiles, readFile, searchInFiles, gitStatus } from "./tools.js";
import { sanitizeForLog } from "./security.js";

/**
 * MCP Server - Güvenli Local Dosya Erişimi
 * Port: 8787
 * Protocol: HTTP/SSE
 */

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8787;

// Tools tanımları
const TOOLS = [
  {
    name: "list_files",
    description:
      "Belirtilen dizindeki dosya ve klasörleri listeler. Varsayılan: proje root.",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Listelenecek dizin yolu (varsayılan: '.')",
          default: ".",
        },
      },
    },
  },
  {
    name: "read_file",
    description:
      "Belirtilen dosyanın içeriğini okur. Sadece text dosyaları okunabilir. Secret'lar otomatik maskelenir.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Okunacak dosya yolu (proje root'a göre)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "search_in_files",
    description:
      "Belirtilen dizinde metin araması yapar. Sonuçlar dosya yolu, satır numarası ve içerik ile döner.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Aranacak metin",
        },
        directory: {
          type: "string",
          description: "Arama yapılacak dizin (varsayılan: '.')",
          default: ".",
        },
        maxResults: {
          type: "number",
          description: "Maksimum sonuç sayısı (varsayılan: 50)",
          default: 50,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "git_status",
    description:
      "Git working tree durumunu kontrol eder. Değişiklik yapılmış dosyaları listeler.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Tool çağrı handler'ı
async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>
) {
  try {
    switch (toolName) {
      case "list_files": {
        const directory =
          typeof args?.directory === "string" ? args.directory : ".";
        const result = await listFiles(directory);
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case "read_file": {
        const filePath =
          typeof args?.filePath === "string" ? args.filePath : undefined;
        if (!filePath) {
          return {
            content: [
              {
                type: "text",
                text: "Error: filePath parameter is required",
              },
            ],
            isError: true,
          };
        }
        const result = await readFile(filePath);
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case "search_in_files": {
        const query =
          typeof args?.query === "string" ? args.query : undefined;
        if (!query) {
          return {
            content: [
              {
                type: "text",
                text: "Error: query parameter is required",
              },
            ],
            isError: true,
          };
        }
        const directory =
          typeof args?.directory === "string" ? args.directory : ".";
        const maxResults =
          typeof args?.maxResults === "number" ? args.maxResults : 50;
        const result = await searchInFiles(query, directory, maxResults);
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case "git_status": {
        const result = await gitStatus();
        if (!result.success) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${result.error}`,
              },
            ],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${toolName}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const errorMessage = sanitizeForLog(
      error instanceof Error ? error.message : String(error)
    );
    console.error(`Tool error [${toolName}]:`, errorMessage);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

// HTTP Server
const httpServer = createServer(async (req, res) => {
  const parsedUrl = parse(req.url || "", true);
  const path = parsedUrl.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: "1.0.0" }));
    return;
  }

  // SSE endpoint for MCP
  if (path === "/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Initial connection message
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 30000);

    req.on("close", () => {
      clearInterval(keepAlive);
      res.end();
    });

    return;
  }

  // HTTP POST endpoint for tool calls
  if (path === "/tools" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const request = JSON.parse(body);
        const { tool, arguments: args } = request;

        if (!tool) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "tool parameter is required" }));
          return;
        }

        const response = await handleToolCall(tool, args || {});

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    });

    return;
  }

  // List tools endpoint
  if (path === "/tools/list" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ tools: TOOLS }));
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Server başlat
httpServer.listen(PORT, () => {
  console.log(`MCP Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Tools list: http://localhost:${PORT}/tools/list`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down MCP server...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\nShutting down MCP server...");
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

