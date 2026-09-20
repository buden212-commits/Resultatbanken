/**
 * Smoke-test: load DB snapshot and exercise getEvents/getResultsIndex.
 * Usage: DATA_SOURCE=db npx tsx scripts/smoke-db.ts
 */
import { ensureDbSnapshot, invalidateDbSnapshot } from "../src/lib/db/store";
import { getEvents, getEvent, getResultsIndex, getPeopleIndex, getResolvedResultsForEvent } from "../src/lib/data";

async function main(): Promise<void> {
  process.env.DATA_SOURCE = "db";
  invalidateDbSnapshot();
  const started = Date.now();
  await ensureDbSnapshot();
  const loadMs = Date.now() - started;

  const events = getEvents();
  const results = getResultsIndex();
  const people = getPeopleIndex();
  const sample = events[0];
  const sampleResults = sample ? getResolvedResultsForEvent(sample.id) : [];
  const byId = sample ? getEvent(sample.id) : undefined;

  const report = {
    loadMs,
    events: events.length,
    results: results.length,
    people: people.length,
    newest: sample ? { id: sample.id, name: sample.name, date: sample.date } : null,
    newestResolvedRows: sampleResults.length,
    getEventOk: Boolean(byId),
    ok:
      events.length === 422 &&
      results.length === 8162 &&
      people.length === 2050 &&
      Boolean(byId),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
