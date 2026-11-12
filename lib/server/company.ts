import "server-only";
import { company } from "@/lib/db/schema";
import type { Company } from "@/lib/invoices";
import { getDb } from "@/lib/server/db";

/** The business sending the invoices, and the date the app treats as today. */
export async function getCompany(): Promise<{ company: Company; today: string }> {
  const db = await getDb();
  const [row] = await db.select().from(company).limit(1);
  if (!row) throw new Error("The company row is missing; run the database migrations");
  const { name, industry, baseCurrency, asOfDate } = row;
  return { company: { name, industry, baseCurrency }, today: asOfDate };
}
