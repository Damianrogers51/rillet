import type { NextRequest } from "next/server";
import { peekInvoiceNumber } from "@/lib/server/invoice-store";

/** The number the next invoice would get, for previewing it; the server assigns the real one on create. */
export async function GET(request: NextRequest) {
  const issueDate = request.nextUrl.searchParams.get("issueDate") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return Response.json({ error: "issueDate must be a YYYY-MM-DD date" }, { status: 400 });
  }
  return Response.json({ invoiceNumber: await peekInvoiceNumber(issueDate) });
}
