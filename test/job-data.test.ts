import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type RecordRow = { p: string; m: "active" | "new" | "placed"; g: number[]; r: number[] };
const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const records = JSON.parse(
  readFileSync(resolve(root, "public/data/jobs.json"), "utf8"),
) as RecordRow[];
const find = (placeId: string, metricId: string) =>
  records.find((item) => item.p === placeId && item.m === metricId);

describe("matched general and regular employee job tables", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      schemaVersion: 1,
      asOf: "2026-08-02",
      edition: "2025年度（令和7年度）まで",
      placeCount: 48,
      prefectureCount: 47,
      metricCount: 3,
      recordCount: 2160,
      seriesCount: 144,
    });
    expect(index.years).toEqual(Array.from({ length: 15 }, (_, i) => 2011 + i));
    expect(index.sources).toEqual([
      expect.objectContaining({
        kind: "general",
        sha256: "275f4b75a347f28f4cfc6133d038390ecaa2aa43728af89b4006eaff8f6e4018",
      }),
      expect.objectContaining({
        kind: "regular",
        sha256: "81150ef91c39330f7743d591598c6340f2fd1659bd4fe5e6708f778d27c53256",
      }),
    ]);
  });
  it("contains one unique series for every place and metric", () => {
    expect(records).toHaveLength(144);
    expect(new Set(records.map((item) => `${item.p}|${item.m}`)).size).toBe(144);
    expect(index.places).toHaveLength(48);
    expect(index.metrics).toHaveLength(3);
  });
  it("retains the nationwide 2025 values", () => {
    expect(find("00", "active")?.g.at(-1)).toBe(27_576_204);
    expect(find("00", "active")?.r.at(-1)).toBe(13_657_110);
    expect(find("00", "new")?.g.at(-1)).toBe(9_532_974);
    expect(find("00", "new")?.r.at(-1)).toBe(4_627_050);
    expect(find("00", "placed")?.g.at(-1)).toBe(1_094_816);
    expect(find("00", "placed")?.r.at(-1)).toBe(413_213);
  });
  it("retains known prefecture rows", () => {
    expect(find("13", "active")?.g.at(-1)).toBe(4_255_491);
    expect(find("13", "active")?.r.at(-1)).toBe(1_898_138);
    expect(find("47", "placed")?.g.at(-1)).toBe(17_893);
    expect(find("47", "placed")?.r.at(-1)).toBe(4_851);
  });
  it("keeps all values positive, matched, and compact", () => {
    for (const record of records) {
      expect(Object.keys(record).sort()).toEqual(["g", "m", "p", "r"]);
      expect(record.g).toHaveLength(15);
      expect(record.r).toHaveLength(15);
      record.g.forEach((value, i) => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
        expect(record.r[i]).toBeGreaterThan(0);
        expect(record.r[i]).toBeLessThanOrEqual(value);
      });
    }
    expect(statSync(resolve(root, "public/data/jobs.json")).size).toBeLessThan(50_000);
  });
  it("keeps nationwide values equal to all 47 labour bureaus", () => {
    for (const metricId of ["active", "new", "placed"]) {
      const rows = records.filter((record) => record.m === metricId);
      const national = rows.find((record) => record.p === "00")!;
      for (let i = 0; i < 15; i += 1) {
        expect(
          rows.filter((record) => record.p !== "00").reduce((sum, record) => sum + record.g[i], 0),
        ).toBe(national.g[i]);
        expect(
          rows.filter((record) => record.p !== "00").reduce((sum, record) => sum + record.r[i], 0),
        ).toBe(national.r[i]);
      }
    }
  });
});
