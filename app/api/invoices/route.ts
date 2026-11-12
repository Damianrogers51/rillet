import type { NextRequest } from "next/server";
import { createInvoice, isPaymentStatus, listInvoices, parseInvoiceInput } from "@/lib/server/invoice-store";
import { readBody, respond } from "@/lib/server/responses";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status") || null;
  if (status !== null && !isPaymentStatus(status)) return Response.json({ error: "Unknown status" }, { status: 400 });
  const limit = Math.min(Math.max(Number(params.get("limit")) || 25, 1), 100);
  return respond(await listInvoices({ status, cursor: params.get("cursor"), limit }));
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const input = parseInvoiceInput(body);
  if (!input.ok) return respond(input);
  if (typeof body.id !== "string" || !body.id) return Response.json({ error: "id is required" }, { status: 422 });
  return respond(await createInvoice({ ...input.value, id: body.id, send: body.send === true }), 201);
}
