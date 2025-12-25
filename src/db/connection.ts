import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// .env dosyalarını yükle (.env.local öncelikli, sonra .env)
dotenv.config({ path: ".env.local" });
dotenv.config();

// DATABASE_URL'yi güvenli al
const url = process.env.DATABASE_URL;
if (!url || typeof url !== "string") {
  throw new Error("DATABASE_URL is missing. Set it in .env.local (or .env).");
}

const pool = new Pool({
  connectionString: url,
});

export const db = drizzle(pool);

