// src/app/uploads/[...path]/route.ts
export const runtime = "nodejs";

import { resolveUploadsPath } from "@/lib/uploads";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

type RouteParams = { path?: string[] | string };
type RouteContext = { params: Promise<RouteParams> | RouteParams };

function contentTypeFor(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function decodeSegments(rawSegments: string[]): string[] {
  return rawSegments.map((seg) => {
    try {
      return decodeURIComponent(seg);
    } catch {
      throw new Error("Bad URL encoding in uploads path");
    }
  });
}

function debugResolvedHeader(segments: string[]): string {
  const summary = segments.slice(-2).join("/");
  return summary.replace(/[^\x20-\x7E]/g, "_").slice(0, 120);
}

function makeDebugHeaders(summary?: string): Headers {
  const headers = new Headers();
  headers.set("X-Uploads-Route", "1");
  if (summary) {
    headers.set("X-Uploads-Resolved", summary);
  }
  return headers;
}

async function handle(_req: Request, ctx: RouteContext, isHead: boolean): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const raw = params?.path;
  const rawSegments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const rawSummary = rawSegments.length > 0 ? debugResolvedHeader(rawSegments) : undefined;

  if (rawSegments.length === 0) {
    return new Response("Not Found", { status: 404, headers: makeDebugHeaders() });
  }

  let segments: string[];
  try {
    segments = decodeSegments(rawSegments);
  } catch {
    return new Response("Bad Request", { status: 400, headers: makeDebugHeaders(rawSummary) });
  }
  const summary = debugResolvedHeader(segments);

  let abs: string;
  try {
    abs = resolveUploadsPath(segments);
  } catch {
    return new Response("Bad Request", { status: 400, headers: makeDebugHeaders(summary) });
  }

  let st;
  try {
    st = await stat(abs);
  } catch {
    return new Response("Not Found", { status: 404, headers: makeDebugHeaders(summary) });
  }

  if (!st.isFile()) {
    return new Response("Not Found", { status: 404, headers: makeDebugHeaders(summary) });
  }

  const headers = makeDebugHeaders(summary);
  headers.set("Content-Type", contentTypeFor(abs));
  headers.set("Content-Length", String(st.size));
  headers.set("Last-Modified", st.mtime.toUTCString());
  headers.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

  if (isHead) return new Response(null, { status: 200, headers });

  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  return new Response(webStream, { status: 200, headers });
}

export async function GET(req: Request, ctx: RouteContext) {
  return handle(req, ctx, false);
}

export async function HEAD(req: Request, ctx: RouteContext) {
  return handle(req, ctx, true);
}
