/**
 * Salva onde o setup/ do Data Model Viewer está instalado (1x no PC).
 * O kit `model-viewer` dentro de cada app lê esse arquivo.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function homeMarkerPath() {
  return path.join(os.homedir(), ".data-model-viewer");
}

export function registerViewerHome(viewerRoot) {
  const root = path.resolve(viewerRoot);
  fs.writeFileSync(homeMarkerPath(), `${root}\n`, "utf8");
  return root;
}

export function readViewerHome() {
  const marker = homeMarkerPath();
  if (!fs.existsSync(marker)) return null;
  const line = fs.readFileSync(marker, "utf8").trim().split(/\r?\n/)[0]?.trim();
  return line || null;
}
