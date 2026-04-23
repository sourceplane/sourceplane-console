import type { IdempotencyStore, IdempotencySuccessRecord } from "../middleware/idempotency.js";

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencySuccessRecord>();

  get(key: string): Promise<IdempotencySuccessRecord | null> {
    return Promise.resolve(this.records.get(key) ?? null);
  }

  put(key: string, record: IdempotencySuccessRecord): Promise<void> {
    this.records.set(key, record);

    return Promise.resolve();
  }
}