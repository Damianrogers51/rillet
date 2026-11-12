import "server-only";
import { company } from "@/lib/db/schema";
import type { Company } from "@/lib/invoices";
import { getDb } from "@/lib/db/client";

// The demo runs on a fixed calendar so due dates and new timestamps read the same whenever it's opened.
const today = "2026-05-04";

/** The business sending the invoices, and the date the app treats as today. */
export async function getCompany(): Promise<{ company: Company; today: string }> {
  const db = await getDb();
  const [row] = await db.select().from(company).limit(1);
  if (!row) throw new Error("The company row is missing; run the database migrations");
  const { name, industry, baseCurrency } = row;
  return { company: { name, industry, baseCurrency }, today };
}
