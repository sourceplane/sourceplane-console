import { createIdempotencyScopeKey, idempotencyHeaderName, type IdempotencyScope } from "@sourceplane/contracts";

import type { ApiEdgeEnv } from "../env.js";
import { EdgeHttpError } from "../errors/edge-error.js";
import { jsonSuccess } from "../http/json.js";
import type { ResolvedActor } from "../types.js";

export const idempotentReplayHeaderName = "x-sourceplane-idempotent-replay";

export interface IdempotencySuccessRecord {
  cursor: string | null;
  data: unknown;
  status: number;
  storedAt: string;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencySuccessRecord | null>;
  put(key: string, record: IdempotencySuccessRecord): Promise<void>;
}

export class KvIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly namespace: KVNamespace,
    private readonly ttlSeconds = 60 * 60 * 24
  ) {}

  async get(key: string): Promise<IdempotencySuccessRecord | null> {
    const storedValue = await this.namespace.get(key, "json");

    return storedValue as IdempotencySuccessRecord | null;
  }

  async put(key: string, record: IdempotencySuccessRecord): Promise<void> {
    await this.namespace.put(key, JSON.stringify(record), {
      expirationTtl: this.ttlSeconds
    });
  }
}

export function createIdempotencyStoreFromEnv(env: ApiEdgeEnv): IdempotencyStore | null {
  return env.EDGE_IDEMPOTENCY ? new KvIdempotencyStore(env.EDGE_IDEMPOTENCY) : null;
}

export function assertIdempotencyPreconditions(options: {
  actor: Pick<ResolvedActor, "id">;
  idempotencyKey: string | null;
  routeSignature: string;
  store: IdempotencyStore | null;
}): string {
  if (!options.idempotencyKey) {
    throw new EdgeHttpError(400, "bad_request", `The ${idempotencyHeaderName} header is required for POST requests.`, {
      header: idempotencyHeaderName,
      route: options.routeSignature
    });
  }

  if (!options.store) {
    throw new EdgeHttpError(
      501,
      "unsupported",
      "The edge idempotency store is not configured for this environment.",
      {
        binding: "EDGE_IDEMPOTENCY"
      }
    );
  }

  return buildIdempotencyCacheKey(
    {
      actorId: options.actor.id,
      route: options.routeSignature
    },
    options.idempotencyKey
  );
}

export async function replayIdempotentSuccessIfPresent(options: {
  cacheKey: string;
  requestId: string;
  store: IdempotencyStore;
}): Promise<Response | null> {
  const existingRecord = await options.store.get(options.cacheKey);
  if (!existingRecord) {
    return null;
  }

  return jsonSuccess(existingRecord.data, {
    cursor: existingRecord.cursor,
    headers: {
      [idempotentReplayHeaderName]: "true"
    },
    requestId: options.requestId,
    status: existingRecord.status
  });
}

export async function storeIdempotentSuccess(options: {
  cacheKey: string;
  cursor?: string | null;
  data: unknown;
  status: number;
  store: IdempotencyStore;
}): Promise<void> {
  await options.store.put(options.cacheKey, {
    cursor: options.cursor ?? null,
    data: options.data,
    status: options.status,
    storedAt: new Date().toISOString()
  });
}

function buildIdempotencyCacheKey(scope: IdempotencyScope, idempotencyKey: string): string {
  return `${createIdempotencyScopeKey(scope)}::${idempotencyKey}`;
}