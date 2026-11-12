import { connect, setUp } from "@/lib/db/client";

// The local database sets itself up on first request, and opening it here would clash with a running dev server.
if (!process.env.DATABASE_URL) {
  console.log("No DATABASE_URL; the local database sets itself up when the app first uses it");
  process.exit(0);
}

const { seeded } = await setUp(connect());
console.log(`Database migrated${seeded ? `, seeded ${seeded} invoices` : ""}`);
process.exit(0);
