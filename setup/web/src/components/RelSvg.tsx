import type { ReactNode } from "react";
import type { DataModel, RelationshipDef } from "../types";
import { tableColor } from "../tableColor";

type Selection =
  | { kind: "table"; tableId: string }
  | { kind: "column"; tableId: string; columnId: string }
  | { kind: "relationship"; relId: string }
  | null;

type DragPreview = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color?: string;
} | null;

type Props = {
  model: DataModel;
  selection: Selection;
  edgeStyle: "curve" | "straight";
  onSelectRel: (relId: string) => void;
  onCycleRelType: (relId: string) => void;
  onRemoveRel: (relId: string) => void;
  tableEls: Map<string, HTMLElement>;
  dragPreview: DragPreview;
  relDiff?: Map<string, import("../modelDiff").DiffKind> | null;
};

function anchor(
  el: HTMLElement | undefined,
  colId: string,
  side: "left" | "right",
) {
  if (!el) return null;
  const col = el.querySelector(`[data-col-id="${colId}"]`) as HTMLElement | null;
  const target = col || el;
  const y = el.offsetTop + target.offsetTop + target.offsetHeight / 2;
  const x = side === "left" ? el.offsetLeft : el.offsetLeft + el.offsetWidth;
  return { x, y };
}

function pickSides(fromEl: HTMLElement, toEl: HTMLElement) {
  const fromCx = fromEl.offsetLeft + fromEl.offsetWidth / 2;
  const toCx = toEl.offsetLeft + toEl.offsetWidth / 2;
  if (fromCx <= toCx) return { from: "right" as const, to: "left" as const };
  return { from: "left" as const, to: "right" as const };
}

function pathGeom(
  a: { x: number; y: number },
  b: { x: number; y: number },
  style: "curve" | "straight",
) {
  if (style === "straight") {
    const midX = (a.x + b.x) / 2;
    return {
      d: `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`,
      label: { x: midX, y: (a.y + b.y) / 2 },
      end: b,
      start: a,
      cNearEnd: { x: midX, y: b.y },
      cNearStart: { x: midX, y: a.y },
    };
  }
  const dx = Math.abs(b.x - a.x);
  const pull = Math.max(40, dx * 0.45);
  const c1x = a.x + (b.x >= a.x ? pull : -pull);
  const c2x = b.x + (b.x >= a.x ? -pull : pull);
  return {
    d: `M ${a.x} ${a.y} C ${c1x} ${a.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`,
    label: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    end: b,
    start: a,
    cNearEnd: { x: c2x, y: b.y },
    cNearStart: { x: c1x, y: a.y },
  };
}

function arrowPoints(
  end: { x: number; y: number },
  control: { x: number; y: number },
) {
  const a = Math.atan2(end.y - control.y, end.x - control.x);
  const size = 14;
  const x1 = end.x - size * Math.cos(a - 0.42);
  const y1 = end.y - size * Math.sin(a - 0.42);
  const x2 = end.x - size * Math.cos(a + 0.42);
  const y2 = end.y - size * Math.sin(a + 0.42);
  return `${end.x},${end.y} ${x1},${y1} ${x2},${y2}`;
}

function displayType(rel: RelationshipDef) {
  return rel.type || "N:1";
}

/** 1:N → seta no N; 1:1 → sem seta; N:N → seta nos dois. */
function visualEnds(
  type: string,
  fromPt: { x: number; y: number },
  toPt: { x: number; y: number },
  fromTable: string,
  toTable: string,
) {
  const t = (type || "N:1").toUpperCase();
  if (t === "N:1") {
    return {
      start: toPt,
      end: fromPt,
      badge: "1:N",
      split: false,
      exitTable: toTable,
      enterTable: fromTable,
      arrows: "end" as const,
    };
  }
  if (t === "1:N") {
    return {
      start: fromPt,
      end: toPt,
      badge: "1:N",
      split: false,
      exitTable: fromTable,
      enterTable: toTable,
      arrows: "end" as const,
    };
  }
  if (t === "1:1") {
    return {
      start: fromPt,
      end: toPt,
      badge: "1:1",
      split: true,
      exitTable: fromTable,
      enterTable: toTable,
      arrows: "none" as const,
    };
  }
  if (t === "N:N") {
    return {
      start: fromPt,
      end: toPt,
      badge: "N:N",
      split: true,
      exitTable: fromTable,
      enterTable: toTable,
      arrows: "both" as const,
    };
  }
  return {
    start: fromPt,
    end: toPt,
    badge: t,
    split: false,
    exitTable: fromTable,
    enterTable: toTable,
    arrows: "end" as const,
  };
}

export function RelSvg({
  model,
  selection,
  edgeStyle,
  onSelectRel,
  onCycleRelType,
  onRemoveRel,
  tableEls,
  dragPreview,
  relDiff = null,
}: Props) {
  const tableIds = model.tables.map((t) => t.id);
  const colorByTable = new Map(
    model.tables.map((t) => [t.id, tableColor(t.id, tableIds)]),
  );

  const paths = model.relationships
    .map((rel) => {
      const fromEl = tableEls.get(rel.fromTable);
      const toEl = tableEls.get(rel.toTable);
      if (!fromEl || !toEl) return null;
      const sides = pickSides(fromEl, toEl);
      const a = anchor(fromEl, rel.fromColumn, sides.from);
      const b = anchor(toEl, rel.toColumn, sides.to);
      if (!a || !b) return null;
      const type = displayType(rel);
      const { start, end, badge, split, exitTable, enterTable, arrows } =
        visualEnds(type, a, b, rel.fromTable, rel.toTable);
      const { d, label, cNearEnd, cNearStart } = pathGeom(start, end, edgeStyle);
      const selected =
        selection?.kind === "relationship" && selection.relId === rel.id;
      const linkedTableId =
        selection?.kind === "table" || selection?.kind === "column"
          ? selection.tableId
          : null;
      const tableLinked = Boolean(
        linkedTableId &&
          (rel.fromTable === linkedTableId || rel.toTable === linkedTableId),
      );
      const rDiff = relDiff?.get(rel.id) || null;
      const cExit = colorByTable.get(exitTable) || "#a78bfa";
      const cEnter = colorByTable.get(enterTable) || "#a78bfa";
      const gradId = `rel-grad-${rel.id}`;
      const stroke = split ? `url(#${gradId})` : cExit;
      const showStartArrow = arrows === "both";
      const showEndArrow = arrows === "end" || arrows === "both";
      const showStartDot = !showStartArrow;
      const showEndDot = !showEndArrow;

      return (
        <g
          key={rel.id}
          className={[
            "rel",
            selected ? "selected" : "",
            tableLinked ? "table-linked" : "",
            rDiff && rDiff !== "same" ? `diff-${rDiff}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >          {split ? (
            <defs>
              <linearGradient
                id={gradId}
                gradientUnits="userSpaceOnUse"
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              >
                <stop offset="0%" stopColor={cExit} />
                <stop offset="50%" stopColor={cExit} />
                <stop offset="50%" stopColor={cEnter} />
                <stop offset="100%" stopColor={cEnter} />
              </linearGradient>
            </defs>
          ) : null}
          <path
            d={d}
            className="rel-hit"
            onClick={(e) => {
              e.stopPropagation();
              onSelectRel(rel.id);
            }}
          />
          <path
            d={d}
            className="rel-line"
            style={{ stroke }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectRel(rel.id);
            }}
          />
          {showStartDot ? (
            <circle
              cx={start.x}
              cy={start.y}
              r={4.5}
              className="rel-start"
              style={{ fill: cExit, stroke: cExit }}
            />
          ) : null}
          {showEndDot ? (
            <circle
              cx={end.x}
              cy={end.y}
              r={4.5}
              className="rel-start"
              style={{ fill: cEnter, stroke: cEnter }}
            />
          ) : null}
          {showStartArrow ? (
            <polygon
              points={arrowPoints(start, cNearStart)}
              className="rel-arrow"
              style={{ fill: cExit }}
            />
          ) : null}
          {showEndArrow ? (
            <polygon
              points={arrowPoints(end, cNearEnd)}
              className="rel-arrow"
              style={{ fill: split ? cEnter : cExit }}
            />
          ) : null}
          <g
            className={`rel-badge ${selected ? "with-actions" : ""}`}
            transform={`translate(${label.x}, ${label.y})`}
          >
            <rect
              className="rel-badge-bg"
              x={selected ? -34 : -22}
              y={-11}
              width={selected ? 68 : 44}
              height={22}
              rx={11}
              ry={11}
              style={{ fill: cExit }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRel(rel.id);
              }}
            />
            <text
              className="rel-badge-type"
              textAnchor="middle"
              dominantBaseline="central"
              x={selected ? -8 : 0}
              y={1}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRel(rel.id);
                onCycleRelType(rel.id);
              }}
            >
              {badge}
            </text>
            {selected ? (
              <g
                className="rel-delete"
                transform="translate(18, 0)"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveRel(rel.id);
                }}
              >
                <circle r={8} />
                <text textAnchor="middle" dominantBaseline="central" y={0.5}>
                  ×
                </text>
              </g>
            ) : null}
          </g>
        </g>
      );
    })
    .filter(Boolean);

  let preview: ReactNode = null;
  if (dragPreview) {
    const { d, end, start, cNearEnd } = pathGeom(
      dragPreview.from,
      dragPreview.to,
      edgeStyle,
    );
    const color = dragPreview.color || "#a78bfa";
    preview = (
      <g className="rel preview">
        <path d={d} className="rel-line" style={{ stroke: color }} />
        <circle
          cx={start.x}
          cy={start.y}
          r={4.5}
          className="rel-start"
          style={{ fill: color, stroke: color }}
        />
        <polygon
          points={arrowPoints(end, cNearEnd)}
          className="rel-arrow"
          style={{ fill: color }}
        />
      </g>
    );
  }

  return (
    <svg className="rel-layer" xmlns="http://www.w3.org/2000/svg">
      {paths}
      {preview}
    </svg>
  );
}
