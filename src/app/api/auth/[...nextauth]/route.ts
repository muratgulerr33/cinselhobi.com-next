import { handlers } from "@/auth";

export const runtime = "nodejs";

// Geçici olarak handlers kontrolü - build için
let GET: any;
let POST: any;

try {
  if (handlers) {
    ({ GET, POST } = handlers);
  } else {
    // Build sırasında handlers undefined olabilir, geçici handler'lar oluştur
    GET = async () => new Response("Auth not configured", { status: 500 });
    POST = async () => new Response("Auth not configured", { status: 500 });
  }
} catch (error) {
  // Build sırasında hata olursa geçici handler'lar oluştur
  GET = async () => new Response("Auth not configured", { status: 500 });
  POST = async () => new Response("Auth not configured", { status: 500 });
}

export { GET, POST };

