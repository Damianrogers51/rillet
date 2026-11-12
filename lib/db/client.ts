import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Connection = {
  db: Database;
  /** Whether this is the embedded database used locally when no Postgres URL is set. */
  local: boolean;
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

const migrationsFolder = "./drizzle";
export const localDataDir = "./.data/pglite";

/** The Supabase integration on Vercel sets POSTGRES_URL; DATABASE_URL works for any other Postgres. */
export function databaseUrl() {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
}

/** Supabase (or any Postgres) when a URL is set, as on Vercel; otherwise an embedded Postgres that saves to `.data/`. */
export function connect(): Connection {
  const url = databaseUrl();
  if (url) {
    // Supabase's pooled URL runs in transaction mode, which can't keep prepared statements between queries.
    const client = postgres(url, { prepare: false });
    const db = drizzlePostgres(client, { schema, casing: "snake_case" });
    return {
      db: db as unknown as Database,
      local: false,
      migrate: async () => {
        // Migrations take locks and run several statements together, so they use the direct connection when there is one.
        const directUrl = process.env.DATABASE_URL ? url : (process.env.POSTGRES_URL_NON_POOLING ?? url);
        const direct = postgres(directUrl, { max: 1, onnotice: () => {} });
        try {
          await migratePostgres(drizzlePostgres(direct, { casing: "snake_case" }), { migrationsFolder });
        } finally {
          await direct.end();
        }
      },
      close: () => client.end(),
    };
  }
  mkdirSync(localDataDir, { recursive: true });
  const pglite = new PGlite(localDataDir);
  const db = drizzlePglite(pglite, { schema, casing: "snake_case" });
  return {
    db: db as unknown as Database,
    local: true,
    migrate: () => migratePglite(db, { migrationsFolder }),
    close: () => pglite.close(),
  };
}
