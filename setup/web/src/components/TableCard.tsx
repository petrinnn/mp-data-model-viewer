import { useEffect, useRef, useState, type CSSProperties } from "react";
import { COLUMN_TYPES, type ColumnDef, type TableDef } from "../types";

type Props = {
  table: TableDef;
  selected: boolean;
  selectedColumnId: string | null;
  relDraftFrom: { tableId: string; columnId: string } | null;
  relHoverTarget: { tableId: string; columnId: string } | null;
  registerEl: (el: HTMLElement | null) => void;
  onSelectTable: () => void;
  onSelectColumn: (columnId: string) => void;
  onMove: (x: number, y: number) => void;
  onUpdateTable: (patch: Partial<TableDef>) => void;
  onRemoveTable: () => void;
  onAddColumn: () => void;
  onUpdateColumn: (columnId: string, patch: Partial<ColumnDef>) => void;
  onRemoveColumn: (columnId: string) => void;
  onRelDragStart: (
    tableId: string,
    columnId: string,
    side: "left" | "right",
    e: React.PointerEvent,
  ) => void;
  onRelDrop: (tableId: string, columnId: string) => void;
  accentColor: string;
};

export function TableCard({
  table,
  selected,
  selectedColumnId,
  relDraftFrom,
  relHoverTarget,
  registerEl,
  onSelectTable,
  onSelectColumn,
  onMove,
  onUpdateTable,
  onRemoveTable,
  onAddColumn,
  onUpdateColumn,
  onRemoveColumn,
  onRelDragStart,
  onRelDrop,
  accentColor,
}: Props) {
  const drag = useRef<{
    ox: number;
    oy: number;
    x: number;
    y: number;
    moved: boolean;
    fromName: boolean;
    pointerId: number;
  } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [typeMenuCol, setTypeMenuCol] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const colRef = useRef<HTMLInputElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const lastNameClick = useRef(0);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    if (editingName) nameRef.current?.select();
  }, [editingName]);

  useEffect(() => {
    if (editingCol) colRef.current?.select();
  }, [editingCol]);

  useEffect(() => {
    if (!typeMenuCol) return;
    function onDoc(e: MouseEvent) {
      if (typeMenuRef.current?.contains(e.target as Node)) return;
      setTypeMenuCol(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTypeMenuCol(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [typeMenuCol]);

  // Garante que o arraste nunca fica “preso” se o pointerup sair do header.
  useEffect(() => {
    function endDrag(ev: PointerEvent) {
      const d = drag.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      const was = d;
      drag.current = null;
      if (was.moved || !was.fromName) return;
      const now = Date.now();
      if (now - lastNameClick.current < 600) {
        setEditingName(true);
        lastNameClick.current = 0;
        return;
      }
      lastNameClick.current = now;
    }
    function onMove(ev: PointerEvent) {
      const d = drag.current;
      if (!d || ev.pointerId !== d.pointerId) return;
      // Só arrasta com botão pressionado (evita “fantasma” ao passar o mouse).
      if (ev.buttons === 0) {
        drag.current = null;
        return;
      }
      const dx = ev.clientX - d.ox;
      const dy = ev.clientY - d.oy;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        d.moved = true;
      }
      const world = document.querySelector(".canvas-world");
      const zoom = world
        ? Number(
            getComputedStyle(world).transform.match(/matrix\(([^,]+)/)?.[1] || 1,
          )
        : 1;
      const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
      onMoveRef.current(d.x + dx / z, d.y + dy / z);
    }
    function onBlur() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("blur", onBlur);
      drag.current = null;
    };
  }, []);

  function onHeaderDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (editingName) return;
    if ((e.target as HTMLElement).closest("input,.icon-btn,.type-menu")) return;
    e.stopPropagation();
    onSelectTable();
    const fromName = Boolean((e.target as HTMLElement).closest(".table-name"));
    drag.current = {
      ox: e.clientX,
      oy: e.clientY,
      x: table.position.x,
      y: table.position.y,
      moved: false,
      fromName,
      pointerId: e.pointerId,
    };
  }

  function startRename(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = null;
    setEditingName(true);
  }

  function togglePk(col: ColumnDef) {
    const pk = !col.pk;
    onUpdateColumn(col.id, {
      pk,
      nullable: pk ? false : col.nullable,
      unique: pk ? true : col.unique,
    });
  }

  const typeOptions = (current: string) =>
    [...COLUMN_TYPES, current].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <article
      className={`table-card ${selected ? "selected" : ""}`}
      style={
        {
          left: table.position.x,
          top: table.position.y,
          "--table-accent": accentColor,
        } as CSSProperties
      }
      ref={registerEl}
      data-table-id={table.id}
    >
      <header
        className="table-card-head"
        onPointerDown={onHeaderDown}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest(".table-name, .table-name-input")) {
            startRename(e);
          }
        }}
      >
        {editingName ? (
          <input
            ref={nameRef}
            className="inline-edit table-name-input"
            value={table.name}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => onUpdateTable({ name: e.target.value })}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") {
                e.preventDefault();
                setEditingName(false);
              }
            }}
          />
        ) : (
          <span
            className="table-name"
            title="Arraste para mover · dois cliques para renomear"
            onDoubleClick={startRename}
            onClick={(e) => {
              if (e.detail === 2) startRename(e);
            }}
          >
            {table.name}
          </span>
        )}
        <div className="table-head-actions">
          <button
            type="button"
            className="icon-btn"
            title="Adicionar campo"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddColumn();
            }}
          >
            +
          </button>
          <button
            type="button"
            className="icon-btn danger"
            title="Excluir tabela"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Excluir tabela ${table.name}?`)) onRemoveTable();
            }}
          >
            ×
          </button>
        </div>
      </header>
      <ul className="table-cols">
        {table.columns.map((col) => {
          const isFrom =
            relDraftFrom?.tableId === table.id && relDraftFrom.columnId === col.id;
          const isDropTarget =
            relHoverTarget?.tableId === table.id &&
            relHoverTarget.columnId === col.id &&
            !isFrom;
          const waitingTarget = Boolean(relDraftFrom) && !isFrom;
          return (
            <li
              key={col.id}
              className={[
                "col-row",
                selectedColumnId === col.id ? "selected" : "",
                isFrom ? "rel-from" : "",
                waitingTarget ? "rel-targetable" : "",
                isDropTarget ? "rel-drop-hover" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-col-id={col.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectColumn(col.id);
              }}
              onPointerUp={(e) => {
                if ((e.target as HTMLElement).closest(".rel-handle")) return;
                onRelDrop(table.id, col.id);
              }}
            >
              <button
                type="button"
                className={`pk-badge ${col.pk ? "active" : ""}`}
                title={col.pk ? "PK ativa — clique para remover" : "Clique para marcar PK"}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePk(col);
                }}
              >
                PK
              </button>

              {editingCol === col.id ? (
                <input
                  ref={colRef}
                  className="inline-edit col-name-input"
                  value={col.name}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdateColumn(col.id, { name: e.target.value })}
                  onBlur={() => setEditingCol(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      e.preventDefault();
                      setEditingCol(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="col-name"
                  title="Clique para renomear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectColumn(col.id);
                    setEditingCol(col.id);
                  }}
                >
                  {col.name}
                </button>
              )}

              <div className="col-type-wrap">
                <button
                  type="button"
                  className={`col-type ${typeMenuCol === col.id ? "open" : ""}`}
                  title="Selecionar tipo"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectColumn(col.id);
                    setTypeMenuCol((cur) => (cur === col.id ? null : col.id));
                  }}
                >
                  {col.type}
                  <span className="col-type-caret" aria-hidden>
                    ▾
                  </span>
                </button>
                {typeMenuCol === col.id ? (
                  <div
                    className="type-menu"
                    ref={typeMenuRef}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {typeOptions(col.type).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`type-menu-item ${t === col.type ? "active" : ""}`}
                        onClick={() => {
                          onUpdateColumn(col.id, { type: t });
                          setTypeMenuCol(null);
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="col-delete"
                title="Excluir campo"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Excluir campo ${col.name}?`)) onRemoveColumn(col.id);
                }}
              >
                ×
              </button>

              <span
                className="rel-handle rel-handle-left"
                title="Arraste até outro campo"
                data-rel-handle="1"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setTypeMenuCol(null);
                  onRelDragStart(table.id, col.id, "left", e);
                }}
              />
              <span
                className="rel-handle rel-handle-right"
                title="Arraste até outro campo"
                data-rel-handle="1"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setTypeMenuCol(null);
                  onRelDragStart(table.id, col.id, "right", e);
                }}
              />
            </li>
          );
        })}
      </ul>
      <footer className="table-card-foot">
        <button type="button" className="add-col-btn" onClick={onAddColumn}>
          + campo
        </button>
      </footer>
    </article>
  );
}
