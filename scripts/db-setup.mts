import { connect, databaseUrl, setUp } from "@/lib/db/client";

// The local database sets itself up on first request, and opening it here would clash with a running dev server.
if (!databaseUrl()) {
  console.log("No POSTGRES_URL or DATABASE_URL; the local database sets itself up when the app first uses it");
  process.exit(0);
}

const connection = connect();
try {
  const { seeded } = await setUp(connection);
  console.log(`Database migrated${seeded ? `, seeded ${seeded} invoices` : ""}`);
} finally {
  await connection.close();
}
