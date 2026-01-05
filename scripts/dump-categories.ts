import { db } from "../src/db/connection";
import { categories } from "../src/db/schema";

async function main() {
  const rows = await db.select().from(categories);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
