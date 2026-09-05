/**
 * API local do Data Model Viewer.
 * Serve a UI e lê/grava apenas arquivos .json de modelagem.
 */
import express from "express";
import path from "node:path";
import { createServer } from "node:http";
import chokidar from "chokidar";
import {
  pickJsonFile,
  readModelFile,
  writeModelFile,
} from "./model-io.mjs";

const port = Number(process.env.DMV_PORT || 4177);
const shouldOpen = process.env.DMV_OPEN !== "0";
const isDev = process.env.DMV_DEV === "1";
const root = process.env.DMV_ROOT;
const initialFile = process.env.DMV_MODEL_FILE || null;

/** @type {string | null} */
let currentFile = initialFile;
let ignoreWatchUntil = 0;
const sseClients = new Set();
/** @type {import("chokidar").FSWatcher | null} */
let watcher = null;

const app = express();
app.use(express.json({ limit: "4mb" }));

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

async function attachWatcher(file) {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  if (!file) return;
  watcher = chokidar.watch(file, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  watcher.on("change", async () => {
    if (Date.now() < ignoreWatchUntil) return;
    if (!currentFile) return;
    try {
      const model = await readModelFile(currentFile);
      broadcast("model-changed", { model, path: currentFile, source: "external" });
    } catch (err) {
      broadcast("model-error", { error: String(err?.message || err) });
    }
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    modelFile: currentFile,
    hasFile: Boolean(currentFile),
    mode: isDev ? "dev" : "prod",
  });
});

app.get("/api/model", async (_req, res) => {
  try {
    if (!currentFile) {
      res.json({ model: null, path: null, needsOpen: true });
      return;
    }
    const model = await readModelFile(currentFile);
    res.json({ model, path: currentFile, needsOpen: false });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.put("/api/model", async (req, res) => {
  try {
    if (!currentFile) {
      res.status(400).json({ error: "Nenhum arquivo aberto. Use Abrir JSON." });
      return;
    }
    ignoreWatchUntil = Date.now() + 800;
    const model = await writeModelFile(currentFile, req.body?.model ?? req.body);
    res.json({ ok: true, model, path: currentFile });
  } catch (err) {
    res.status(500).json({ error: String(err?.message || err) });
  }
});

app.post("/api/open", async (req, res) => {
  try {
    let file = typeof req.body?.path === "string" ? req.body.path.trim() : "";
    if (!file) {
      file = (await pickJsonFile()) || "";
    }
    if (!file) {
      res.status(400).json({ error: "Nenhum arquivo selecionado.", cancelled: true });
      return;
    }
    const model = await readModelFile(file);
    currentFile = file;
    await attachWatcher(file);
    broadcast("model-changed", { model, path: file, source: "open" });
    res.json({ ok: true, model, path: file });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/User canceled|cancelou|-128/i.test(msg)) {
      res.status(400).json({ error: "Cancelado.", cancelled: true });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

app.post("/api/close", async (_req, res) => {
  currentFile = null;
  await attachWatcher(null);
  broadcast("model-closed", { path: null });
  res.json({ ok: true, needsOpen: true });
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(
    `event: hello\ndata: ${JSON.stringify({ path: currentFile })}\n\n`,
  );
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

if (isDev) {
  app.get("/", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>Data Model Viewer</title></head>
<body style="font-family:system-ui;padding:2rem">
  <h1>API do Data Model Viewer</h1>
  <p>UI em <a href="http://127.0.0.1:5177">http://127.0.0.1:5177</a></p>
  <p>Arquivo: <code>${currentFile || "(nenhum)"}</code></p>
</body></html>`);
  });
} else {
  const dist = path.join(root, "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

if (currentFile) await attachWatcher(currentFile);

const server = createServer(app);
server.listen(port, async () => {
  const uiUrl = isDev ? "http://127.0.0.1:5177" : `http://127.0.0.1:${port}`;
  console.log("");
  console.log("Data Model Viewer");
  console.log(`  arquivo: ${currentFile || "(abra um JSON na UI)"}`);
  console.log(`  API    : http://127.0.0.1:${port}`);
  console.log(`  UI     : ${uiUrl}`);
  console.log("");

  if (shouldOpen) {
    try {
      const open = (await import("open")).default;
      await open(uiUrl);
    } catch {
      /* ignore */
    }
  }
});
