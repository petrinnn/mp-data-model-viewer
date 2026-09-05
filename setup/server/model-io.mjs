/**
 * Leitura/gravação de um arquivo de modelagem (.json).
 * Sem tocar em banco. Sem cópia interna.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const MODEL_FILE_NAME = "data-model.json";

export function modelPath(projectDir) {
  return path.join(projectDir, MODEL_FILE_NAME);
}

export function emptyModel(name = "Projeto") {
  return {
    version: 1,
    name,
    tables: [],
    relationships: [],
    view: { panX: 0, panY: 0, zoom: 1 },
  };
}

export async function ensureModelFile(projectDir, { withExample = false } = {}) {
  const file = modelPath(projectDir);
  try {
    await fs.access(file);
    return { file, created: false };
  } catch {
    const data = emptyModel(path.basename(projectDir));
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return { file, created: true };
  }
}

export async function readModelFile(file) {
  const raw = await fs.readFile(file, "utf8");
  return normalizeModel(JSON.parse(raw));
}

export async function writeModelFile(file, data) {
  const normalized = normalizeModel(data);
  await fs.writeFile(file, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

/** @deprecated use readModelFile(modelPath(dir)) */
export async function readModel(projectDir) {
  return readModelFile(modelPath(projectDir));
}

/** @deprecated use writeModelFile(modelPath(dir), data) */
export async function writeModel(projectDir, data) {
  return writeModelFile(modelPath(projectDir), data);
}

export function normalizeModel(input) {
  const root = input && typeof input === "object" ? input : {};
  const tables = Array.isArray(root.tables) ? root.tables : [];
  return {
    version: typeof root.version === "number" ? root.version : 1,
    name: typeof root.name === "string" && root.name.trim() ? root.name.trim() : "Projeto",
    tables: tables.map((t, ti) => normalizeTable(t, ti)),
    relationships: (Array.isArray(root.relationships) ? root.relationships : [])
      .map((r, i) => normalizeRel(r, i))
      .filter(Boolean),
    view: {
      panX: Number(root.view?.panX) || 0,
      panY: Number(root.view?.panY) || 0,
      zoom: Number(root.view?.zoom) || 1,
      edgeStyle: root.view?.edgeStyle === "straight" ? "straight" : "curve",
    },
  };
}

function normalizeTable(t, index) {
  const id = typeof t?.id === "string" && t.id ? t.id : `tbl_${randomUUID().slice(0, 8)}`;
  const columns = Array.isArray(t?.columns) ? t.columns : [];
  return {
    id,
    name: typeof t?.name === "string" && t.name.trim() ? t.name.trim() : `table_${index + 1}`,
    description: typeof t?.description === "string" ? t.description : "",
    position: {
      x: Number(t?.position?.x) || 40 + index * 40,
      y: Number(t?.position?.y) || 40 + index * 24,
    },
    columns: columns.map((c, ci) => normalizeColumn(c, ci)),
  };
}

function normalizeColumn(c, index) {
  return {
    id: typeof c?.id === "string" && c.id ? c.id : `col_${randomUUID().slice(0, 8)}`,
    name: typeof c?.name === "string" && c.name.trim() ? c.name.trim() : `col_${index + 1}`,
    type: typeof c?.type === "string" && c.type.trim() ? c.type.trim() : "text",
    pk: Boolean(c?.pk),
    nullable: c?.nullable === undefined ? true : Boolean(c.nullable),
    unique: Boolean(c?.unique),
    description: typeof c?.description === "string" ? c.description : "",
  };
}

function normalizeRel(r, index) {
  if (!r || !r.fromTable || !r.toTable || !r.fromColumn || !r.toColumn) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : `rel_${index + 1}`,
    type: typeof r.type === "string" && r.type ? r.type : "N:1",
    fromTable: r.fromTable,
    fromColumn: r.fromColumn,
    toTable: r.toTable,
    toColumn: r.toColumn,
  };
}

/** Diálogo nativo para escolher um .json (Mac / Windows). */
export async function pickJsonFile() {
  if (process.platform === "darwin") {
    const script = `
set theFile to choose file with prompt "Abrir data-model.json" of type {"json", "public.json"}
return POSIX path of theFile
`;
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim();
  }

  if (process.platform === "win32") {
    const ps = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Filter = "JSON (*.json)|*.json|Todos (*.*)|*.*"
$d.Title = "Abrir data-model.json"
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.FileName }
`;
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      ps,
    ]);
    const p = stdout.trim();
    return p || null;
  }

  // Linux (opcional): zenity
  try {
    const { stdout } = await execFileAsync("zenity", [
      "--file-selection",
      "--title=Abrir data-model.json",
      "--file-filter=*.json",
    ]);
    return stdout.trim();
  } catch {
    throw new Error("Seletor de arquivo não disponível neste sistema.");
  }
}

export async function resolveTarget(arg) {
  if (!arg) return { mode: "browse", file: null };
  const resolved = path.resolve(arg);
  try {
    const st = await fs.stat(resolved);
    if (st.isFile()) return { mode: "file", file: resolved };
    if (st.isDirectory()) {
      const file = modelPath(resolved);
      await ensureModelFile(resolved);
      return { mode: "file", file };
    }
  } catch {
    /* fallthrough */
  }
  throw new Error(`Caminho inválido: ${arg}`);
}
