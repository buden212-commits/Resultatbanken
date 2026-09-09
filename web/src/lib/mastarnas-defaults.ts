import type { MastarnasClass, MastarnasData, MastarnasDiscipline } from "./mastarnas-types";

export const DEFAULT_CLASSES: MastarnasClass[] = [
  { id: "d10", name: "D10", is_youth: true },
  { id: "d12", name: "D12", is_youth: true },
  { id: "d14", name: "D14", is_youth: true },
  { id: "d16", name: "D16", is_youth: true },
  { id: "d17-34", name: "D17-34", is_youth: false },
  { id: "d35", name: "D35", is_youth: false },
  { id: "d45", name: "D45", is_youth: false },
  { id: "d55", name: "D55", is_youth: false },
  { id: "d65", name: "D65", is_youth: false },
  { id: "d75", name: "D75", is_youth: false },
  { id: "h10", name: "H10", is_youth: true },
  { id: "h12", name: "H12", is_youth: true },
  { id: "h14", name: "H14", is_youth: true },
  { id: "h16", name: "H16", is_youth: true },
  { id: "h17-34", name: "H17-34", is_youth: false },
  { id: "h35", name: "H35", is_youth: false },
  { id: "h45", name: "H45", is_youth: false },
  { id: "h55", name: "H55", is_youth: false },
  { id: "h65", name: "H65", is_youth: false },
  { id: "h75", name: "H75", is_youth: false },
];

export const DEFAULT_DISCIPLINES: MastarnasDiscipline[] = [
  { id: "skidor", name: "Skidor", sort_order: 1, is_medel: false },
  { id: "skid-o", name: "Skid-o", sort_order: 2, is_medel: false },
  { id: "indoor", name: "Indoor", sort_order: 3, is_medel: false },
  { id: "medel", name: "Medel", sort_order: 4, is_medel: true },
  { id: "lang", name: "Lång", sort_order: 5, is_medel: false },
  { id: "sprint", name: "Sprint", sort_order: 6, is_medel: false },
  { id: "mtb-o", name: "Mtb-o", sort_order: 7, is_medel: false },
  { id: "terrang", name: "Terräng", sort_order: 8, is_medel: false },
  { id: "natt", name: "Natt", sort_order: 9, is_medel: false },
];

export function emptyMastarnasData(): MastarnasData {
  return {
    classes: DEFAULT_CLASSES.map((item) => ({ ...item })),
    disciplines: DEFAULT_DISCIPLINES.map((item) => ({ ...item })),
    seasons: [],
    class_import_map: {},
  };
}
