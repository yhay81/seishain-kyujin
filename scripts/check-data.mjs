import { readFile } from "node:fs/promises";

const index = JSON.parse(
  await readFile(new URL("../public/data/index.json", import.meta.url), "utf8"),
);
const records = JSON.parse(
  await readFile(new URL("../public/data/jobs.json", import.meta.url), "utf8"),
);
const expectedYears = Array.from({ length: 15 }, (_, i) => 2011 + i);

if (index.placeCount !== 48 || index.prefectureCount !== 47)
  throw new Error("Expected nationwide total and 47 labour bureaus");
if (index.metricCount !== 3 || index.recordCount !== 2160 || index.seriesCount !== 144)
  throw new Error("Unexpected index dimensions");
if (JSON.stringify(index.years) !== JSON.stringify(expectedYears))
  throw new Error("Unexpected years");
if (records.length !== 144) throw new Error("Unexpected series count");
if (new Set(index.places.map((item) => item.id)).size !== 48) throw new Error("Duplicate place id");
if (new Set(index.metrics.map((item) => item.id)).size !== 3)
  throw new Error("Duplicate metric id");
const placeIds = new Set(index.places.map((item) => item.id));
const metricIds = new Set(index.metrics.map((item) => item.id));
const keys = new Set();
for (const record of records) {
  if (!placeIds.has(record.p) || !metricIds.has(record.m)) throw new Error("Unknown dimension");
  const key = `${record.p}|${record.m}`;
  if (keys.has(key)) throw new Error(`Duplicate record: ${key}`);
  keys.add(key);
  for (const series of [record.g, record.r]) {
    if (!Array.isArray(series) || series.length !== 15) throw new Error(`${key}: invalid series`);
    if (series.some((value) => !Number.isInteger(value) || value <= 0))
      throw new Error(`${key}: invalid value`);
  }
  if (record.r.some((value, i) => value > record.g[i]))
    throw new Error(`${key}: regular exceeds general`);
}
for (const metricId of metricIds) {
  const metricRecords = records.filter((record) => record.m === metricId);
  const nationwide = metricRecords.find((record) => record.p === "00");
  for (let i = 0; i < expectedYears.length; i += 1) {
    const generalSum = metricRecords
      .filter((record) => record.p !== "00")
      .reduce((sum, record) => sum + record.g[i], 0);
    const regularSum = metricRecords
      .filter((record) => record.p !== "00")
      .reduce((sum, record) => sum + record.r[i], 0);
    if (nationwide.g[i] !== generalSum || nationwide.r[i] !== regularSum)
      throw new Error(`${metricId} ${expectedYears[i]}: national sum mismatch`);
  }
}
if (
  index.sources.length !== 2 ||
  index.sources.some((source) => !/^[0-9a-f]{64}$/u.test(source.sha256))
)
  throw new Error("Invalid source SHA-256");
const nationalActive = records.find((record) => record.p === "00" && record.m === "active");
const nationalNew = records.find((record) => record.p === "00" && record.m === "new");
const nationalPlaced = records.find((record) => record.p === "00" && record.m === "placed");
if (nationalActive.g.at(-1) !== 27576204 || nationalActive.r.at(-1) !== 13657110)
  throw new Error("National active values changed");
if (nationalNew.g.at(-1) !== 9532974 || nationalNew.r.at(-1) !== 4627050)
  throw new Error("National new values changed");
if (nationalPlaced.g.at(-1) !== 1094816 || nationalPlaced.r.at(-1) !== 413213)
  throw new Error("National placement values changed");

console.log(
  JSON.stringify({
    asOf: index.asOf,
    checked: index.recordCount,
    metrics: index.metricCount,
    places: index.placeCount,
    series: records.length,
  }),
);
