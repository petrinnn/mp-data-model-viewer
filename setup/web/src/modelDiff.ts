import type { ColumnDef, DataModel, RelationshipDef, TableDef } from "./types";

export type DiffKind = "same" | "new" | "changed" | "removed";

export type ModelDiff = {
  tables: Map<string, DiffKind>;
  columns: Map<string, DiffKind>; // key: `${tableId}::${columnId}`
  relationships: Map<string, DiffKind>;
  /** Tabelas só no baseline (foram removidas do alvo). */
  removedTables: TableDef[];
  /** Colunas removidas por tabela alvo (key = tableId no alvo). */
  removedColumns: Map<string, ColumnDef[]>;
  counts: { new: number; changed: number; removed: number };
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

function colSig(c: ColumnDef) {
  return JSON.stringify({
    name: norm(c.name),
    type: norm(c.type),
    pk: Boolean(c.pk),
    nullable: Boolean(c.nullable),
    unique: Boolean(c.unique),
  });
}

function findTable(list: TableDef[], id: string, name: string) {
  return (
    list.find((t) => t.id === id) ||
    list.find((t) => norm(t.name) === norm(name)) ||
    null
  );
}

function findCol(list: ColumnDef[], id: string, name: string) {
  return (
    list.find((c) => c.id === id) ||
    list.find((c) => norm(c.name) === norm(name)) ||
    null
  );
}

function relKey(r: RelationshipDef) {
  return `${r.fromTable}|${r.fromColumn}|${r.toTable}|${r.toColumn}|${(r.type || "").toUpperCase()}`;
}

export function emptyDiff(): ModelDiff {
  return {
    tables: new Map(),
    columns: new Map(),
    relationships: new Map(),
    removedTables: [],
    removedColumns: new Map(),
    counts: { new: 0, changed: 0, removed: 0 },
  };
}

/** Diff alvo (model) × baseline. Novo = só no alvo; removido = só no baseline. */
export function diffModels(
  model: DataModel,
  baseline: DataModel | null,
): ModelDiff {
  if (!baseline) return emptyDiff();

  const tables = new Map<string, DiffKind>();
  const columns = new Map<string, DiffKind>();
  const relationships = new Map<string, DiffKind>();
  const removedTables: TableDef[] = [];
  const removedColumns = new Map<string, ColumnDef[]>();
  const counts = { new: 0, changed: 0, removed: 0 };

  const matchedBaselineTableIds = new Set<string>();

  for (const t of model.tables) {
    const bt = findTable(baseline.tables, t.id, t.name);
    if (!bt) {
      tables.set(t.id, "new");
      counts.new++;
      for (const c of t.columns) {
        columns.set(`${t.id}::${c.id}`, "new");
        counts.new++;
      }
      continue;
    }
    matchedBaselineTableIds.add(bt.id);
    let tableChanged = norm(t.name) !== norm(bt.name);
    const matchedBaseCols = new Set<string>();

    for (const c of t.columns) {
      const bc = findCol(bt.columns, c.id, c.name);
      if (!bc) {
        columns.set(`${t.id}::${c.id}`, "new");
        counts.new++;
        tableChanged = true;
        continue;
      }
      matchedBaseCols.add(bc.id);
      if (colSig(c) !== colSig(bc)) {
        columns.set(`${t.id}::${c.id}`, "changed");
        counts.changed++;
        tableChanged = true;
      } else {
        columns.set(`${t.id}::${c.id}`, "same");
      }
    }

    const goneCols: ColumnDef[] = [];
    for (const bc of bt.columns) {
      if (matchedBaseCols.has(bc.id)) continue;
      if (t.columns.some((c) => norm(c.name) === norm(bc.name))) continue;
      goneCols.push(bc);
      counts.removed++;
      tableChanged = true;
    }
    if (goneCols.length) removedColumns.set(t.id, goneCols);

    if (tableChanged) {
      tables.set(t.id, tables.get(t.id) === "new" ? "new" : "changed");
      if (tables.get(t.id) === "changed") counts.changed++;
    } else {
      tables.set(t.id, "same");
    }
  }

  for (const bt of baseline.tables) {
    if (matchedBaselineTableIds.has(bt.id)) continue;
    if (model.tables.some((t) => norm(t.name) === norm(bt.name))) continue;
    removedTables.push(bt);
    counts.removed++;
    for (const _c of bt.columns) counts.removed++;
  }

  const baseRelById = new Map(baseline.relationships.map((r) => [r.id, r]));
  const baseRelByKey = new Map(baseline.relationships.map((r) => [relKey(r), r]));
  const matchedBaseRels = new Set<string>();

  for (const r of model.relationships) {
    const br = baseRelById.get(r.id) || baseRelByKey.get(relKey(r));
    if (!br) {
      relationships.set(r.id, "new");
      counts.new++;
      continue;
    }
    matchedBaseRels.add(br.id);
    if (relKey(r) !== relKey(br)) {
      relationships.set(r.id, "changed");
      counts.changed++;
    } else {
      relationships.set(r.id, "same");
    }
  }

  for (const br of baseline.relationships) {
    if (matchedBaseRels.has(br.id)) continue;
    if (model.relationships.some((r) => relKey(r) === relKey(br))) continue;
    relationships.set(br.id, "removed");
    counts.removed++;
  }

  return {
    tables,
    columns,
    relationships,
    removedTables,
    removedColumns,
    counts,
  };
}
