#!/usr/bin/env node
/**
 * CLI: model-viewer [opções] [pasta-ou-arquivo.json]
 *
 * Sem argumento → abre o viewer; escolha o JSON na UI.
 * Com pasta → usa <pasta>/data-model.json
 * Com arquivo .json → abre esse arquivo
 *
 * Se a porta já estiver em uso pelo viewer, só abre o navegador (não quebra).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveTarget } from "../server/model-io.mjs";
import { registerViewerHome } from "../server/register-home.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function printHelp() {
  console.log(`
Data Model Viewer

Uso:
  model-viewer              abre e deixa escolher o JSON
  model-viewer .            abre data-model.json desta pasta
  model-viewer caminho.json abre esse arquivo

Opções:
  --dev       desenvolvimento (Vite)
  --port N    porta (padrão 4177)
  --no-open   não abre o browser
  -h, --help
`);
}

function parseArgs(argv) {
  const args = { target: null, dev: false, port: 4177, open: true };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }
    if (a === "--dev") {
      args.dev = true;
      continue;
    }
    if (a === "--no-open") {
      args.open = false;
      continue;
    }
    if (a === "--port") {
      args.port = Number(argv[++i] || 4177);
      continue;
    }
    if (a.startsWith("--port=")) {
      args.port = Number(a.slice("--port=".length));
      continue;
    }
    rest.push(a);
  }
  args.target = rest[0] || null;
  return args;
}

async function ensureBuilt() {
  const distIndex = path.join(ROOT, "dist", "index.html");
  const { existsSync } = await import("node:fs");
  if (existsSync(distIndex)) return;
  console.log("Build do frontend ainda não existe. Rodando vite build…");
  await new Promise((resolve, reject) => {
    const child = spawn("npx", ["vite", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`vite build exit ${code}`)),
    );
  });
}

async function viewerAlreadyUp(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

async function openBrowser(url) {
  try {
    const open = (await import("open")).default;
    await open(url);
  } catch {
    /* ignore */
  }
}

async function reuseRunningViewer(port, file, shouldOpen) {
  const uiUrl = `http://127.0.0.1:${port}`;
  try {
    if (file) {
      await fetch(`${uiUrl}/api/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file }),
      });
    } else {
      // Abrir sem alvo = tela vazia (sem exemplo / sem arquivo)
      await fetch(`${uiUrl}/api/close`, { method: "POST" });
    }
  } catch {
    /* ignore */
  }
  if (shouldOpen) await openBrowser(uiUrl);
  console.log("Viewer já estava aberto → navegador.");
}

async function main() {
  registerViewerHome(ROOT);
  const args = parseArgs(process.argv.slice(2));
  const resolved = await resolveTarget(args.target);

  if (!args.dev && (await viewerAlreadyUp(args.port))) {
    await reuseRunningViewer(args.port, resolved.file, args.open);
    process.exit(0);
  }

  process.env.DMV_PORT = String(args.port);
  process.env.DMV_OPEN = args.open ? "1" : "0";
  process.env.DMV_DEV = args.dev ? "1" : "0";
  process.env.DMV_ROOT = ROOT;
  if (resolved.file) process.env.DMV_MODEL_FILE = resolved.file;
  else delete process.env.DMV_MODEL_FILE;
  process.env.DMV_PROJECT_DIR = resolved.file
    ? path.dirname(resolved.file)
    : ROOT;

  if (args.dev) {
    const vite = spawn("npx", ["vite", "--port", "5177", "--strictPort"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env },
    });
    process.on("exit", () => vite.kill());
    process.on("SIGINT", () => {
      vite.kill();
      process.exit(0);
    });
  } else {
    await ensureBuilt();
  }

  const serverUrl = pathToFileURL(path.join(ROOT, "server", "index.mjs")).href;
  await import(serverUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
