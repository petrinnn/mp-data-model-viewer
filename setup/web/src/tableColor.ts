/** Paleta ampla e bem distinta (borda + relações). */
const PALETTE = [
  "#3dd6c3",
  "#5b8def",
  "#f0a202",
  "#e85d75",
  "#9b7bff",
  "#ff6b35",
  "#4cc9f0",
  "#f72585",
  "#80ed99",
  "#ffd166",
  "#06d6a0",
  "#ef476f",
  "#118ab2",
  "#ff9f1c",
  "#7b2cbf",
  "#2a9d8f",
  "#e9c46a",
  "#e76f51",
  "#00bbf9",
  "#f15bb5",
  "#00f5d4",
  "#fee440",
  "#9b5de5",
  "#f94144",
  "#43aa8b",
  "#577590",
  "#f3722c",
  "#90be6d",
  "#4d908e",
  "#c77dff",
];

/** Índice estável por id — tabelas diferentes pegam cores sequenciais distintas. */
export function tableColor(tableId: string, allTableIds: string[] = []): string {
  if (allTableIds.length) {
    const sorted = [...allTableIds].sort();
    const idx = sorted.indexOf(tableId);
    if (idx >= 0) return PALETTE[idx % PALETTE.length];
  }
  let h = 0;
  for (let i = 0; i < tableId.length; i++) {
    h = (h * 31 + tableId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
