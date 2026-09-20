import { ensureDbSnapshot, useDbData } from "./store";

/** Warm DB snapshot when DATA_SOURCE=db. No-op in JSON mode. */
export async function ensureDataReady(): Promise<void> {
  if (useDbData()) {
    await ensureDbSnapshot();
  }
}
