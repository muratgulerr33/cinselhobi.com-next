#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT_DIRS = ["src/components", "src/hooks"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

function collectFiles(dir, acc) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, acc);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(fullPath);
    }
  }
}

function isUseClientModule(sourceFile) {
  const first = sourceFile.statements[0];
  return (
    Boolean(first) &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use client"
  );
}

function isComponentOrHookName(name) {
  return /^[A-Z]/.test(name) || name.startsWith("use");
}

function findCandidateRoots(sourceFile) {
  const roots = [];

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
      if (isComponentOrHookName(stmt.name.text)) {
        roots.push({ name: stmt.name.text, node: stmt });
      }
      continue;
    }

    if (!ts.isVariableStatement(stmt)) continue;

    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      const init = decl.initializer;
      const isFn = ts.isArrowFunction(init) || ts.isFunctionExpression(init);
      if (!isFn) continue;
      if (!isComponentOrHookName(decl.name.text)) continue;
      roots.push({ name: decl.name.text, node: init });
    }
  }

  return roots;
}

function isTypeofWindow(node) {
  return (
    ts.isTypeOfExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "window"
  );
}

function scanRoot(sourceFile, rootName, rootNode, fileText) {
  const findings = [];

  function visit(node, nestedFunctionDepth) {
    if (isTypeofWindow(node) && nestedFunctionDepth === 0) {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const line = fileText.split("\n")[pos.line] ?? "";
      findings.push({
        rootName,
        line: pos.line + 1,
        column: pos.character + 1,
        snippet: line.trim(),
      });
    }

    const entersNestedFunction = ts.isFunctionLike(node) && node !== rootNode;
    const nextDepth = entersNestedFunction ? nestedFunctionDepth + 1 : nestedFunctionDepth;
    node.forEachChild((child) => visit(child, nextDepth));
  }

  if (rootNode.body) {
    visit(rootNode.body, 0);
  } else {
    visit(rootNode, 0);
  }

  return findings;
}

const files = [];
for (const dir of ROOT_DIRS) {
  collectFiles(dir, files);
}

const allFindings = [];
for (const filePath of files) {
  const text = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (!isUseClientModule(sourceFile)) continue;

  const roots = findCandidateRoots(sourceFile);
  for (const root of roots) {
    const findings = scanRoot(sourceFile, root.name, root.node, text);
    for (const item of findings) {
      allFindings.push({ filePath, ...item });
    }
  }
}

if (allFindings.length === 0) {
  console.log("Hydration guardrail: no render-time `typeof window` usage found in client components/hooks.");
  process.exit(0);
}

console.log("Hydration guardrail findings (render-time `typeof window` in client component/hook body):");
for (const finding of allFindings) {
  console.log(
    `- ${finding.filePath}:${finding.line}:${finding.column} [${finding.rootName}] ${finding.snippet}`
  );
}
process.exit(1);
