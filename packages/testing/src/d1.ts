import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { D1Database } from "@cloudflare/workers-types";

interface TestD1PreparedStatement {
  all<T = Record<string, unknown>>(): Promise<{ meta: { changes: number }; results: T[]; success: true }>;
  bind(...values: unknown[]): TestD1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run(): Promise<{ meta: { changes: number }; success: true }>;
}

interface TestD1Binding {
  exec(query: string): Promise<{ count: number }>;
  prepare(query: string): TestD1PreparedStatement;
}

export interface TestD1Database {
  binding: D1Database;
  close(): void;
}

export function createTestD1Database(filename = ":memory:"): TestD1Database {
  const database = new DatabaseSync(filename);
  const binding = createBinding(database);

  return {
    binding: binding as unknown as D1Database,
    close(): void {
      database.close();
    }
  };
}

export async function applyD1Migrations(binding: D1Database, migrationsDirectory: string): Promise<void> {
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  for (const migrationFile of migrationFiles) {
    const migrationSql = readFileSync(join(migrationsDirectory, migrationFile), "utf8");
    await binding.exec(migrationSql);
  }
}

function createBinding(database: DatabaseSync): TestD1Binding {
  return {
    exec(query: string): Promise<{ count: number }> {
      database.exec(query);

      return Promise.resolve({
        count: 0
      });
    },
    prepare(query: string): TestD1PreparedStatement {
      return createPreparedStatement(database, query);
    }
  };
}

function createPreparedStatement(
  database: DatabaseSync,
  query: string,
  bindings: readonly unknown[] = []
): TestD1PreparedStatement {
  return {
    all<T = Record<string, unknown>>(): Promise<{ meta: { changes: number }; results: T[]; success: true }> {
      const statement = database.prepare(query);
      const rows = statement.all(...bindings.map(toSqliteValue)) as T[];

      return Promise.resolve({
        meta: {
          changes: 0
        },
        results: rows,
        success: true
      });
    },
    bind(...values: unknown[]): TestD1PreparedStatement {
      return createPreparedStatement(database, query, values);
    },
    first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
      const statement = database.prepare(query);
      const row = statement.get(...bindings.map(toSqliteValue)) as Record<string, unknown> | undefined;

      if (!row) {
        return Promise.resolve(null);
      }

      if (columnName) {
        return Promise.resolve((row[columnName] as T | null | undefined) ?? null);
      }

      return Promise.resolve(row as T);
    },
    run(): Promise<{ meta: { changes: number }; success: true }> {
      const statement = database.prepare(query);
      const result = statement.run(...bindings.map(toSqliteValue)) as { changes?: number };

      return Promise.resolve({
        meta: {
          changes: result.changes ?? 0
        },
        success: true
      });
    }
  };
}

function toSqliteValue(value: unknown): Buffer | number | string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" || typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }

  return JSON.stringify(value);
}