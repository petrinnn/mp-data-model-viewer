#!/usr/bin/env node
/**
 * Uso no app (depois de colar esta pasta):
 *   node model-viewer
 *   npm run model
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const marker = path.join(os.homedir(), ".data-model-viewer");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function ensureNpmScript() {
  const pkgPath = path.join(appRoot, "package.json");
  try {
    if (!fs.existsSync(pkgPath)) {
      const name = path
        .basename(appRoot)
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "app";
      const pkg = {
        name,
        private: true,
        scripts: {
          model: "node model-viewer",
        },
      };
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
      console.log("Criado package.json mínimo com script \"model\".");
      console.log("Da próxima vez: npm run model   (ou de novo: node model-viewer)");
      return;
    }
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw);
    pkg.scripts = pkg.scripts || {};
    if (pkg.scripts.model) return;
    pkg.scripts.model = "node model-viewer";
    const endsWithNewline = raw.endsWith("\n");
    let out = `${JSON.stringify(pkg, null, 2)}`;
    if (endsWithNewline) out += "\n";
    fs.writeFileSync(pkgPath, out, "utf8");
    console.log('Adicionado no package.json: "model": "node model-viewer"');
    console.log("Da próxima vez: npm run model");
  } catch {
    /* package.json inválido — ignora */
  }
}

if (!fs.existsSync(marker)) {
  fail(
    "Data Model Viewer ainda não foi aberto neste PC.\n" +
      "Na pasta do Data Model Viewer, dê duplo clique em Abrir.command (Mac)\n" +
      "ou Abrir.bat (Windows) — o arquivo Abrir fica ao lado da pasta setup/.\n" +
      "Depois rode de novo: node model-viewer   ou   npm run model",
  );
}

const viewerRoot = fs.readFileSync(marker, "utf8").trim().split(/\r?\n/)[0].trim();
const bin = path.join(viewerRoot, "bin", "model-viewer.mjs");

if (!fs.existsSync(bin)) {
  fail(
    `Setup do Data Model Viewer não encontrado em:\n  ${viewerRoot}\n` +
      "Abra o Abrir.command/Abrir.bat de novo (ele atualiza o caminho).",
  );
}

const modelFile = path.join(appRoot, "data-model.json");
if (!fs.existsSync(modelFile)) {
  const empty = {
    version: 1,
    name: path.basename(appRoot),
    tables: [],
    relationships: [],
    view: { panX: 0, panY: 0, zoom: 1 },
  };
  fs.writeFileSync(modelFile, `${JSON.stringify(empty, null, 2)}\n`, "utf8");
  console.log("Criado data-model.json na raiz do app.");
}

const ruleSrc = path.join(__dirname, "data-model.mdc");
if (fs.existsSync(ruleSrc)) {
  const raw = fs.readFileSync(ruleSrc, "utf8");
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, "");

  // Cursor
  const cursorDir = path.join(appRoot, ".cursor", "rules");
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.copyFileSync(ruleSrc, path.join(cursorDir, "data-model.mdc"));

  // Qualquer agente (VS Code, Claude Code, Codex, etc.)
  const mdPath = path.join(appRoot, "data-model.md");
  fs.writeFileSync(
    mdPath,
    `# Data model — instruções para o agente\n\n${body.trim()}\n`,
    "utf8",
  );
  console.log("Instruções: data-model.md (qualquer agente)");
  console.log("            .cursor/rules/data-model.mdc (Cursor)");
}

ensureNpmScript();

const child = spawn(process.execPath, [bin, appRoot], {
  stdio: "inherit",
  cwd: viewerRoot,
});
child.on("exit", (code) => process.exit(code ?? 0));
