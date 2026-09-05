import { useEffect, useRef, useState } from "react";
import type { DataModel } from "../types";
import { TableCard } from "./TableCard";
import { RelSvg } from "./RelSvg";
import type { ColumnDef, TableDef } from "../types";
import { tableColor } from "../tableColor";

type Selection =
  | { kind: "table"; tableId: string }
  | { kind: "column"; tableId: string; columnId: string }
  | { kind: "relationship"; relId: string }
  | null;

type RelDrag = {
  fromTable: string;
  fromColumn: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
};

type RelHover = { tableId: string; columnId: string } | null;

function findColUnderPoint(clientX: number, clientY: number): RelHover {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    const row = (el as HTMLElement).closest?.("[data-col-id]") as HTMLElement | null;
    const card = row?.closest?.("[data-table-id]") as HTMLElement | null;
    if (row?.dataset.colId && card?.dataset.tableId) {
      return { tableId: card.dataset.tableId, columnId: row.dataset.colId };
    }
  }
  return null;
}

type Props = {
  model: DataModel;
  selection: Selection;
  edgeStyle: "curve" | "straight";
  onSelect: (s: Selection) => void;
  onMoveTable: (tableId: string, x: number, y: number) => void;
  onUpdateTable: (tableId: string, patch: Partial<TableDef>) => void;
  onRemoveTable: (tableId: string) => void;
  onAddColumn: (tableId: string) => void;
  onUpdateColumn: (tableId: string, columnId: string, patch: Partial<ColumnDef>) => void;
  onRemoveColumn: (tableId: string, columnId: string) => void;
  onCreateRel: (
    fromTable: string,
    fromColumn: string,
    toTable: string,
    toColumn: string,
  ) => void;
  onCycleRelType: (relId: string) => void;
  onRemoveRelationship: (relId: string) => void;
  onViewChange: (view: DataModel["view"]) => void;
};

function clientToWorld(
  viewportEl: HTMLElement,
  clientX: number,
  clientY: number,
  pan: { panX: number; panY: number; zoom: number },
) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left - pan.panX) / pan.zoom,
    y: (clientY - rect.top - pan.panY) / pan.zoom,
  };
}

export function Canvas({
  model,
  selection,
  edgeStyle,
  onSelect,
  onMoveTable,
  onUpdateTable,
  onRemoveTable,
  onAddColumn,
  onUpdateColumn,
  onRemoveColumn,
  onCreateRel,
  onCycleRelType,
  onRemoveRelationship,
  onViewChange,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState(model.view);
  const dragPan = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const tableEls = useRef<Map<string, HTMLElement>>(new Map());
  const [, force] = useState(0);
  const [relDrag, setRelDrag] = useState<RelDrag | null>(null);
  const relDragRef = useRef<RelDrag | null>(null);
  const [relHover, setRelHover] = useState<RelHover>(null);

  useEffect(() => {
    setPan(model.view);
  }, [model.view.panX, model.view.panY, model.view.zoom]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => force((n) => n + 1));
    return () => window.cancelAnimationFrame(id);
  }, [model.tables, model.relationships, pan.zoom, relDrag, edgeStyle]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        relDragRef.current = null;
        setRelDrag(null);
        setRelHover(null);
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        selection?.kind === "relationship" &&
        !(e.target as HTMLElement)?.matches?.("input,textarea")
      ) {
        e.preventDefault();
        onRemoveRelationship(selection.relId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, onRemoveRelationship]);

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldX = (mx - pan.panX) / pan.zoom;
    const worldY = (my - pan.panY) / pan.zoom;
    const nextZoom = Math.min(2, Math.max(0.4, pan.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    const next = {
      panX: mx - worldX * nextZoom,
      panY: my - worldY * nextZoom,
      zoom: nextZoom,
      edgeStyle,
    };
    setPan(next);
    onViewChange(next);
  }

  function onPointerDownBg(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as HTMLElement).closest(".table-card, .rel-badge, .rel-hit, .rel-line"))
      return;
    dragPan.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.panX,
      panY: pan.panY,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMoveBg(e: React.PointerEvent) {
    if (relDragRef.current && viewportRef.current) {
      const to = clientToWorld(viewportRef.current, e.clientX, e.clientY, pan);
      const next = { ...relDragRef.current, to };
      relDragRef.current = next;
      setRelDrag(next);
      const under = findColUnderPoint(e.clientX, e.clientY);
      const same =
        under &&
        under.tableId === next.fromTable &&
        under.columnId === next.fromColumn;
      setRelHover(same ? null : under);
      return;
    }
    if (!dragPan.current) return;
    if (e.buttons === 0) {
      dragPan.current = null;
      return;
    }
    const dx = e.clientX - dragPan.current.x;
    const dy = e.clientY - dragPan.current.y;
    if (!dragPan.current.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      dragPan.current.moved = true;
    }
    const next = {
      ...pan,
      panX: dragPan.current.panX + dx,
      panY: dragPan.current.panY + dy,
    };
    setPan(next);
  }

  function onPointerUpBg(e: React.PointerEvent) {
    if (relDragRef.current) {
      const draft = relDragRef.current;
      const under = findColUnderPoint(e.clientX, e.clientY);
      if (
        under &&
        !(draft.fromTable === under.tableId && draft.fromColumn === under.columnId)
      ) {
        onCreateRel(draft.fromTable, draft.fromColumn, under.tableId, under.columnId);
      }
      relDragRef.current = null;
      setRelDrag(null);
      setRelHover(null);
      return;
    }
    if (!dragPan.current) return;
    const wasPan = dragPan.current.moved;
    dragPan.current = null;
    if (!wasPan) {
      onSelect(null);
      return;
    }
    onViewChange({ ...pan, edgeStyle });
  }

  function onPointerCancelBg() {
    relDragRef.current = null;
    setRelDrag(null);
    setRelHover(null);
    dragPan.current = null;
  }

  function onRelDragStart(
    tableId: string,
    columnId: string,
    side: "left" | "right",
    e: React.PointerEvent,
  ) {
    const card = tableEls.current.get(tableId);
    if (!card || !viewportRef.current) return;
    const row = card.querySelector(`[data-col-id="${columnId}"]`) as HTMLElement | null;
    const from = {
      x: side === "left" ? card.offsetLeft : card.offsetLeft + card.offsetWidth,
      y: card.offsetTop + (row ? row.offsetTop + row.offsetHeight / 2 : 20),
    };
    const to = clientToWorld(viewportRef.current, e.clientX, e.clientY, pan);
    const draft: RelDrag = {
      fromTable: tableId,
      fromColumn: columnId,
      from,
      to,
      color: tableColor(tableId, model.tables.map((t) => t.id)),
    };
    relDragRef.current = draft;
    setRelDrag(draft);
    viewportRef.current.setPointerCapture(e.pointerId);
  }

  return (
    <div
      className={`canvas-viewport ${relDrag ? "rel-dragging" : ""}`}
      ref={viewportRef}
      onWheel={onWheel}
      onPointerDown={onPointerDownBg}
      onPointerMove={onPointerMoveBg}
      onPointerUp={onPointerUpBg}
      onPointerCancel={onPointerCancelBg}
      onLostPointerCapture={onPointerCancelBg}
    >
      <div
        className="canvas-world"
        ref={worldRef}
        style={{
          transform: `translate(${pan.panX}px, ${pan.panY}px) scale(${pan.zoom})`,
        }}
      >
        <RelSvg
          model={model}
          selection={selection}
          edgeStyle={edgeStyle}
          tableEls={tableEls.current}
          dragPreview={
            relDrag
              ? { from: relDrag.from, to: relDrag.to, color: relDrag.color }
              : null
          }
          onSelectRel={(relId) => onSelect({ kind: "relationship", relId })}
          onCycleRelType={onCycleRelType}
          onRemoveRel={onRemoveRelationship}
        />
        {model.tables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            accentColor={tableColor(
              table.id,
              model.tables.map((t) => t.id),
            )}
            selected={
              selection?.kind === "table"
                ? selection.tableId === table.id
                : selection?.kind === "column"
                  ? selection.tableId === table.id
                  : false
            }
            selectedColumnId={
              selection?.kind === "column" && selection.tableId === table.id
                ? selection.columnId
                : null
            }
            relDraftFrom={
              relDrag
                ? { tableId: relDrag.fromTable, columnId: relDrag.fromColumn }
                : null
            }
            relHoverTarget={relHover}
            registerEl={(el) => {
              if (el) tableEls.current.set(table.id, el);
              else tableEls.current.delete(table.id);
            }}
            onSelectTable={() => onSelect({ kind: "table", tableId: table.id })}
            onSelectColumn={(columnId) =>
              onSelect({ kind: "column", tableId: table.id, columnId })
            }
            onMove={(x, y) => onMoveTable(table.id, x, y)}
            onUpdateTable={(patch) => onUpdateTable(table.id, patch)}
            onRemoveTable={() => onRemoveTable(table.id)}
            onAddColumn={() => onAddColumn(table.id)}
            onUpdateColumn={(columnId, patch) =>
              onUpdateColumn(table.id, columnId, patch)
            }
            onRemoveColumn={(columnId) => onRemoveColumn(table.id, columnId)}
            onRelDragStart={onRelDragStart}
            onRelDrop={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
