import { useEffect, useRef, useState } from "react";
import { fetchModel, openModelFile, saveModel, subscribeModelEvents } from "./api";
import { Canvas } from "./components/Canvas";
import {
  createEmptyColumn,
  createEmptyTable,
  newId,
  type ColumnDef,
  type DataModel,
  type RelationshipDef,
  type TableDef,
} from "./types";

type Selection =
  | { kind: "table"; tableId: string }
  | { kind: "column"; tableId: string; columnId: string }
  | { kind: "relationship"; relId: string }
  | null;

const REL_TYPES = ["1:N", "N:1", "1:1", "N:N"] as const;

export function App() {
  const [model, setModel] = useState<DataModel | null>(null);
  const [path, setPath] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "needs-open" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [externalFlash, setExternalFlash] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const savedRef = useRef("");

  function snapshot(m: DataModel) {
    return JSON.stringify(m);
  }

  function markClean(m: DataModel) {
    savedRef.current = snapshot(m);
    setModel(m);
    setDirty(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchModel();
        if (cancelled) return;
        if (!data.model || data.needsOpen) {
          setModel(null);
          setPath("");
          savedRef.current = "";
          setDirty(false);
          setStatus("needs-open");
          return;
        }
        markClean(data.model);
        setPath(data.path || "");
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeModelEvents({
      onChanged: (next, source, nextPath) => {
        if (nextPath) setPath(nextPath);
        markClean(next);
        setStatus("ready");
        if (source === "external") {
          setExternalFlash(true);
          window.setTimeout(() => setExternalFlash(false), 1800);
        }
      },
      onClosed: () => {
        setModel(null);
        setPath("");
        savedRef.current = "";
        setDirty(false);
        setSelection(null);
        setStatus("needs-open");
      },
      onError: (msg) => setError(msg),
    });
  }, []);

  function patchModel(updater: (prev: DataModel) => DataModel) {
    setModel((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setDirty(snapshot(next) !== savedRef.current);
      return next;
    });
  }

  async function handleOpen() {
    setOpening(true);
    setError("");
    try {
      const data = await openModelFile();
      if (data.cancelled) return;
      markClean(data.model);
      setPath(data.path);
      setStatus("ready");
    } catch (err) {
      setError(String(err));
    } finally {
      setOpening(false);
    }
  }

  async function handleSave() {
    if (!model || saving || !dirty) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveModel(model);
      markClean(saved);
      if (!path) {
        const data = await fetchModel();
        if (data.path) setPath(data.path);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void handleOpen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function addTable() {
    if (!model) return;
    const table = createEmptyTable(model.tables.length);
    const offset = model.tables.length;
    table.position = {
      x: 100 + (offset % 6) * 36,
      y: 80 + Math.floor(offset / 6) * 36,
    };
    patchModel((prev) => ({ ...prev, tables: [...prev.tables, table] }));
    setSelection({ kind: "table", tableId: table.id });
  }

  function updateTable(tableId: string, patch: Partial<TableDef>) {
    patchModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === tableId ? { ...t, ...patch } : t)),
    }));
  }

  function removeTable(tableId: string) {
    patchModel((prev) => ({
      ...prev,
      tables: prev.tables.filter((t) => t.id !== tableId),
      relationships: prev.relationships.filter(
        (r) => r.fromTable !== tableId && r.toTable !== tableId,
      ),
    }));
    setSelection(null);
  }

  function addColumn(tableId: string) {
    const col = createEmptyColumn();
    patchModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) =>
        t.id === tableId ? { ...t, columns: [...t.columns, col] } : t,
      ),
    }));
    setSelection({ kind: "column", tableId, columnId: col.id });
  }

  function updateColumn(tableId: string, columnId: string, patch: Partial<ColumnDef>) {
    patchModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (t.id !== tableId) return t;
        return {
          ...t,
          columns: t.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)),
        };
      }),
    }));
  }

  function removeColumn(tableId: string, columnId: string) {
    patchModel((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (t.id !== tableId) return t;
        return { ...t, columns: t.columns.filter((c) => c.id !== columnId) };
      }),
      relationships: prev.relationships.filter(
        (r) =>
          !(
            (r.fromTable === tableId && r.fromColumn === columnId) ||
            (r.toTable === tableId && r.toColumn === columnId)
          ),
      ),
    }));
    setSelection({ kind: "table", tableId });
  }

  function moveTable(tableId: string, x: number, y: number) {
    updateTable(tableId, { position: { x, y } });
  }

  function createRel(
    fromTable: string,
    fromColumn: string,
    toTable: string,
    toColumn: string,
  ) {
    const exists = model?.relationships.some(
      (r) =>
        r.fromTable === fromTable &&
        r.fromColumn === fromColumn &&
        r.toTable === toTable &&
        r.toColumn === toColumn,
    );
    if (exists) return;

    const toTbl = model?.tables.find((t) => t.id === toTable);
    const toCol = toTbl?.columns.find((c) => c.id === toColumn);
    const type = toCol?.pk ? "N:1" : "1:N";

    const rel: RelationshipDef = {
      id: newId("rel"),
      type,
      fromTable,
      fromColumn,
      toTable,
      toColumn,
    };
    patchModel((prev) => ({
      ...prev,
      relationships: [...prev.relationships, rel],
    }));
    setSelection({ kind: "relationship", relId: rel.id });
  }

  function cycleRelType(relId: string) {
    patchModel((prev) => ({
      ...prev,
      relationships: prev.relationships.map((r) => {
        if (r.id !== relId) return r;
        const idx = REL_TYPES.indexOf(r.type as (typeof REL_TYPES)[number]);
        const next = REL_TYPES[(idx + 1) % REL_TYPES.length];
        return { ...r, type: next };
      }),
    }));
  }

  function removeRelationship(relId: string) {
    patchModel((prev) => ({
      ...prev,
      relationships: prev.relationships.filter((r) => r.id !== relId),
    }));
    setSelection(null);
  }

  function updateView(view: DataModel["view"]) {
    patchModel((prev) => {
      const cur = prev.view;
      if (
        cur.panX === view.panX &&
        cur.panY === view.panY &&
        cur.zoom === view.zoom &&
        (cur.edgeStyle || "curve") === (view.edgeStyle || "curve")
      ) {
        return prev;
      }
      return { ...prev, view };
    });
  }

  if (status === "loading") {
    return <div className="boot">Carregando…</div>;
  }

  if (status === "error") {
    return (
      <div className="boot boot-error">
        <p>Não foi possível abrir.</p>
        <pre>{error}</pre>
        <button type="button" className="btn primary" onClick={() => void handleOpen()}>
          Abrir JSON
        </button>
      </div>
    );
  }

  if (status === "needs-open" || !model) {
    return (
      <div className="welcome-screen">
        <div className="welcome-glow" aria-hidden />
        <div className="welcome-grid" aria-hidden />
        <a
          href="https://app.mundopower.com.br"
          target="_blank"
          rel="noreferrer"
          className="welcome-logo-link"
        >
          <img
            className="welcome-logo"
            src="/logo-mundo-power-horizontal-mono.png"
            alt="Mundo Power"
          />
        </a>
        <svg className="welcome-diagram" viewBox="0 0 420 180" aria-hidden>
            <rect className="wd-card" x="24" y="36" width="130" height="108" rx="12" />
            <rect className="wd-head" x="24" y="36" width="130" height="28" rx="12" />
            <rect className="wd-row" x="36" y="78" width="72" height="8" rx="2" />
            <rect className="wd-row" x="36" y="96" width="96" height="8" rx="2" />
            <rect className="wd-row" x="36" y="114" width="54" height="8" rx="2" />
            <rect className="wd-card" x="266" y="36" width="130" height="108" rx="12" />
            <rect className="wd-head" x="266" y="36" width="130" height="28" rx="12" />
            <rect className="wd-row" x="278" y="78" width="72" height="8" rx="2" />
            <rect className="wd-row" x="278" y="96" width="96" height="8" rx="2" />
            <path
              className="wd-rel"
              d="M 154 100 C 200 100, 220 100, 266 100"
              fill="none"
            />
            <circle className="wd-dot" cx="154" cy="100" r="4" />
            <polygon className="wd-arrow" points="266,100 256,95 256,105" />
            <rect className="wd-badge" x="188" y="88" width="36" height="22" rx="11" />
        </svg>
        <div className="welcome-copy">
          <p className="welcome-brand">Data Model Viewer</p>
          <h1>Modele os dados do seu projeto</h1>
          <p className="welcome-sub">
            Abra um <code>data-model.json</code> e edite tabelas, campos e
            relacionamentos no diagrama.
          </p>
          <button
            type="button"
            className="welcome-cta"
            disabled={opening}
            onClick={() => void handleOpen()}
          >
            {opening ? "Abrindo…" : "Abrir JSON"}
          </button>
          {error ? <pre className="welcome-error">{error}</pre> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <a
            className="brand-logo-link"
            href="https://app.mundopower.com.br"
            target="_blank"
            rel="noreferrer"
            title="Abrir Mundo Power"
          >
            <img
              className="brand-logo"
              src="/logo-mundo-power-horizontal-mono.png"
              alt="Mundo Power"
            />
          </a>
          <span className="tool-sep" aria-hidden>
            |
          </span>
          <strong className="tool-name">Data Model Viewer</strong>
        </div>

        <div className="topbar-center" role="group" aria-label="Estilo das linhas">
          <button
            type="button"
            className={`icon-toggle ${(model.view.edgeStyle || "curve") === "curve" ? "active" : ""}`}
            title="Linhas curvas"
            onClick={() =>
              patchModel((p) => ({
                ...p,
                view: { ...p.view, edgeStyle: "curve" },
              }))
            }
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
              <path
                d="M1 12 C6 12 6 2 17 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className={`icon-toggle ${model.view.edgeStyle === "straight" ? "active" : ""}`}
            title="Linhas ortogonais"
            onClick={() =>
              patchModel((p) => ({
                ...p,
                view: { ...p.view, edgeStyle: "straight" },
              }))
            }
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
              <path
                d="M1 11 H9 V3 H17"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="topbar-right">
          <button type="button" className="btn" onClick={addTable}>
            Adicionar Tabela
          </button>
          <button
            type="button"
            className="btn"
            disabled={opening}
            onClick={() => void handleOpen()}
          >
            Abrir JSON
          </button>
          <button
            type="button"
            className={`btn save-btn ${dirty ? "unsaved" : "is-saved"}`}
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
          >
            {saving ? "Salvando…" : dirty ? "Salvar" : "Salvo"}
          </button>
          <input
            className="project-name"
            value={model.name}
            onChange={(e) => patchModel((p) => ({ ...p, name: e.target.value }))}
            title="Nome do projeto no JSON"
            placeholder="Nome do projeto"
          />
        </div>
      </header>

      <div className="workspace">
        <Canvas
          model={model}
          selection={selection}
          edgeStyle={model.view.edgeStyle === "straight" ? "straight" : "curve"}
          onSelect={setSelection}
          onMoveTable={moveTable}
          onUpdateTable={updateTable}
          onRemoveTable={removeTable}
          onAddColumn={addColumn}
          onUpdateColumn={updateColumn}
          onRemoveColumn={removeColumn}
          onCreateRel={createRel}
          onCycleRelType={cycleRelType}
          onRemoveRelationship={removeRelationship}
          onViewChange={updateView}
        />
      </div>

      {error ? <div className="toast error">{error}</div> : null}
      {externalFlash ? (
        <div className="toast">Atualizado do disco</div>
      ) : null}
      <footer className="hint">
        Arraste ○ dos dois lados · duplo clique no nome da tabela pra editar · linhas
        curvas/retas no meio do header · Cmd/Ctrl+S salva
      </footer>
    </div>
  );
}
