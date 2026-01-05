// scripts/print-category-tree.ts
// Run: node --import tsx scripts/print-category-tree.ts
// Or:  npm run tree:categories

import dotenv from "dotenv";
import { db } from "../src/db/connection";
import { categories } from "../src/db/schema";

dotenv.config({ path: ".env.local" });
dotenv.config();

type Row = {
  id: number; // only for internal lookups; DO NOT print
  wcId: number;
  parentWcId: number | null;
  slug: string;
  name: string;
};

function indent(level: number) {
  return "  ".repeat(level);
}

async function main() {
  const rows: Row[] = await db
    .select({
      id: categories.id,
      wcId: categories.wcId,
      parentWcId: categories.parentWcId,
      slug: categories.slug,
      name: categories.name,
    })
    .from(categories);

  // Map: parentWcId -> children[]
  const childrenByParent = new Map<number, Row[]>();
  for (const r of rows) {
    if (r.parentWcId == null || r.parentWcId === 0) continue;
    const arr = childrenByParent.get(r.parentWcId) ?? [];
    arr.push(r);
    childrenByParent.set(r.parentWcId, arr);
  }

  // Stable-ish output
  for (const [, arr] of childrenByParent) {
    arr.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }

  const topLevel = rows
    .filter((r) => r.parentWcId == null || r.parentWcId === 0)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const visited = new Set<number>(); // wcId

  function printNode(node: Row, level: number) {
    const line = `${indent(level)}- ${node.name} (${node.slug}) [wcId:${node.wcId}]`;
    console.log(line);

    if (visited.has(node.wcId)) {
      console.log(`${indent(level + 1)}⚠️ cycle-detected (wcId:${node.wcId})`);
      return;
    }
    visited.add(node.wcId);

    const children = childrenByParent.get(node.wcId) ?? [];
    for (const child of children) {
      printNode(child, level + 1);
    }

    visited.delete(node.wcId);
  }

  console.log("\nCATEGORY TREE (IDs hidden)\n");
  for (const root of topLevel) {
    printNode(root, 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

