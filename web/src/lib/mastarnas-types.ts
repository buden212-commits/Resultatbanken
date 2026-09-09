export type MastarnasStatus = "ok" | "dnf" | "dns";

export type MastarnasClass = {
  id: string;
  name: string;
  is_youth: boolean;
};

export type MastarnasDiscipline = {
  id: string;
  name: string;
  sort_order: number;
  is_medel: boolean;
};

export type MastarnasResult = {
  id: string;
  person_key: string;
  name: string;
  class_id: string;
  place: number | null;
  status: MastarnasStatus;
  /** Historical/manual points. When set, used as-is instead of the placement table. */
  points: number | null;
};

export type MastarnasEvent = {
  id: string;
  discipline_id: string;
  name: string;
  date: string;
  results: MastarnasResult[];
};

export type MastarnasSeason = {
  year: number;
  events: MastarnasEvent[];
};

export type MastarnasData = {
  classes: MastarnasClass[];
  disciplines: MastarnasDiscipline[];
  seasons: MastarnasSeason[];
};

export type MastarnasResultInput = {
  person_key?: string;
  name: string;
  place: number | null;
  status: MastarnasStatus;
  points?: number | null;
};
