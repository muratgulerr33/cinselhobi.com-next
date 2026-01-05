/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const fileList = [
  "01.project-brief.md",
  "02.architecture-lock.md",
  "03.routes-and-navigation-map.md",
  "04.design-system.md",
  "05.native-ux-rules.md",
  "06.frontend-standards-2026.md",
  "07.component-inventory.md",
  "08.api-contracts-frontend.md",
  "09.data-fetching-cache-rules.md",
  "10.tasks-playbook.md",
  "11.qa-test-matrix.md",
  "12.release-prod-checklist.md",
  "13.security-and-deps.md",
  "14.gemini-bridge-instructions.md",
];

const outputFileName = "00.gemini-master-pack.md";
const outputPath = path.join(__dirname, outputFileName);

const priority = "02 > 04 > 05 > 08 > 03 > 09 > 06 > 07 > 10 > 11 > 12 > 01 > 13 > 14";
const toc = fileList
  .map((f, i) => `- DOC-${String(i + 1).padStart(2, "0")}: ${f}`)
  .join("\n");

let masterContent = [
  "# Gemini Master Knowledge Pack (DOC-01 … DOC-14)",
  `> Generated on: ${new Date().toISOString()}`,
  "> Single source of truth. Do not invent routesndpoints/fields. Use Unknown/Assumption when needed.",
  "",
  `**Priority Order:** ${priority}`,
  "",
  "## Table of Contents",
  toc,
  "",
  "---",
  "",
].join("\n");

console.log("🚀 Merge başladı...");

for (let i = 0; i < fileList.length; i++) {
  const fileName = fileList[i];
  const filePath = path.join(__dirname, fileName);

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Bulunamadı (atlandı): ${fileName}`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n").trimEnd();

  masterContent += `\n# DOC-${String(i + 1).padStart(2, "0")}: ${fileName}\n\n---\n`;
  masterContent += content;
  masterContent += `\n---\n`;

  console.log(`✅ Eklendi: ${fileName}`);
}

fs.writeFileSync(outputPath, masterContent, "utf-8");
console.log(`\n🎉 Tamam! Oluşan dosya: ${outputFileName}`);
