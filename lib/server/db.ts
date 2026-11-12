import "server-only";
import { connect, type Database } from "@/lib/db/client";

// Every route bundle gets its own copy of this module, and two embedded databases can't share one data folder, so
// the connection lives on globalThis.
const shared = globalThis as typeof globalThis & { database?: Promise<Database> };

/** Production databases are migrated by the build; the local one sets itself up on first use. */
export function getDb() {
  return (shared.database ??= (async () => {
    const connection = connect();
    if (connection.local) await connection.migrate();
    return connection.db;
  })().catch((error) => {
    shared.database = undefined;
    throw error;
  }));
}
