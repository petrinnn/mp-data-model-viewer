export type ColumnDef = {
  id: string;
  name: string;
  type: string;
  pk: boolean;
  nullable: boolean;
  unique: boolean;
  description: string;
};

export type TableDef = {
  id: string;
  name: string;
  description: string;
  position: { x: number; y: number };
  columns: ColumnDef[];
};

export type RelationshipDef = {
  id: string;
  type: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
};

export type DataModel = {
  version: number;
  name: string;
  tables: TableDef[];
  relationships: RelationshipDef[];
  view: {
    panX: number;
    panY: number;
    zoom: number;
    edgeStyle?: "curve" | "straight";
  };
};

/** Tipos comuns no menu (atalho). Qualquer string do Postgres/Supabase é válida e preservada. */
export const COLUMN_TYPES = [
  "uuid",
  "text",
  "varchar",
  "char",
  "int",
  "int2",
  "int4",
  "int8",
  "bigint",
  "smallint",
  "boolean",
  "bool",
  "numeric",
  "decimal",
  "real",
  "float4",
  "double precision",
  "float8",
  "money",
  "date",
  "time",
  "timetz",
  "timestamp",
  "timestamptz",
  "interval",
  "json",
  "jsonb",
  "bytea",
  "inet",
  "cidr",
  "macaddr",
  "citext",
  "ltree",
  "vector",
  "tsvector",
  "tsquery",
  "xml",
  "uuid[]",
  "text[]",
  "int[]",
  "jsonb[]",
] as const;

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyTable(index = 0): TableDef {
  const id = newId("tbl");
  const pkId = newId("col");
  return {
    id,
    name: `table_${index + 1}`,
    description: "",
    position: { x: 60 + (index % 4) * 40, y: 60 + Math.floor(index / 4) * 40 },
    columns: [
      {
        id: pkId,
        name: "id",
        type: "uuid",
        pk: true,
        nullable: false,
        unique: true,
        description: "",
      },
    ],
  };
}

export function createEmptyColumn(): ColumnDef {
  return {
    id: newId("col"),
    name: "new_column",
    type: "text",
    pk: false,
    nullable: true,
    unique: false,
    description: "",
  };
}
