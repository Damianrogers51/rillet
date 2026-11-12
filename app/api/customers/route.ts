import { connection } from "next/server";
import { listCustomers } from "@/lib/server/invoice-store";

export async function GET() {
  // Reads live data without touching the request, which would otherwise let it be prerendered at build time.
  await connection();
  return Response.json(await listCustomers());
}
