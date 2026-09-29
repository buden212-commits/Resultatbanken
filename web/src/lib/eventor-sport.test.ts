import { describe, expect, it } from "vitest";

import {
  detectEventorSportKind,
  filterRowsBySport,
} from "./eventor-sport";

describe("eventor sport detection", () => {
  it("uses discipline id when present", () => {
    expect(detectEventorSportKind({ disciplineId: "1", eventName: "MTBO-KM" })).toBe("footo");
    expect(detectEventorSportKind({ disciplineId: "2" })).toBe("skio");
    expect(detectEventorSportKind({ disciplineId: "3" })).toBe("mtbo");
  });

  it("falls back to event name", () => {
    expect(detectEventorSportKind({ eventName: "Klubbmästerskap MTBO" })).toBe("mtbo");
    expect(detectEventorSportKind({ eventName: "SkidoKM 2023" })).toBe("skio");
    expect(detectEventorSportKind({ eventName: "skido-KM" })).toBe("skio");
    expect(detectEventorSportKind({ eventName: "KM i skidorientering" })).toBe("skio");
    expect(detectEventorSportKind({ eventName: "Siljan Open Medel" })).toBe("footo");
    expect(detectEventorSportKind({ eventName: "Klubbmästerskap i längdskidor" })).toBe("footo");
  });

  it("filters mtbo and skio", () => {
    const rows = [
      { eventName: "Medel", sportKind: "footo" as const },
      { eventName: "MTBO-KM", sportKind: "mtbo" as const },
      { eventName: "SkidoKM", sportKind: "skio" as const },
    ];
    expect(
      filterRowsBySport(rows, { excludeMtbo: true, excludeSkio: true }).map((r) => r.eventName),
    ).toEqual(["Medel"]);
    expect(
      filterRowsBySport(rows, { excludeMtbo: false, excludeSkio: true }).map((r) => r.eventName),
    ).toEqual(["Medel", "MTBO-KM"]);
  });
});
