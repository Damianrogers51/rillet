import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { count } from "drizzle-orm";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { migrate as migrateNeon } from "drizzle-orm/neon-http/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";
import { invoices as seedInvoices } from "@/lib/invoice-data";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Connection = {
  db: Database;
  /** Whether this is the embedded database used locally when no DATABASE_URL is set. */
  local: boolean;
  migrate: () => Promise<void>;
};

const migrationsFolder = "./drizzle";
export const localDataDir = "./.data/pglite";

/** Neon when DATABASE_URL is set, as on Vercel; otherwise an embedded Postgres that saves to `.data/`. */
export function connect(): Connection {
  const url = process.env.DATABASE_URL;
  if (url) {
    const db = drizzleNeon(neon(url), { schema, casing: "snake_case" });
    return { db: db as unknown as Database, local: false, migrate: () => migrateNeon(db, { migrationsFolder }) };
  }
  mkdirSync(localDataDir, { recursive: true });
  const db = drizzlePglite(new PGlite(localDataDir), { schema, casing: "snake_case" });
  return { db: db as unknown as Database, local: true, migrate: () => migratePglite(db, { migrationsFolder }) };
}

/** Applies pending migrations, then fills an empty database with the sample invoices. */
export async function setUp({ db, migrate }: Connection) {
  await migrate();
  const [{ total }] = await db.select({ total: count() }).from(schema.invoices);
  if (total > 0) return { seeded: 0 };
  const rows = seedInvoices.map((invoice) => ({ ...invoice, paidDate: invoice.paidDate ?? null }));
  await db.insert(schema.invoices).values(rows).onConflictDoNothing();
  return { seeded: rows.length };
}
