import { deleteInvoice, getInvoice, parseInvoiceInput, replaceInvoice } from "@/lib/server/invoice-store";
import { parseActivityId, readBody, respond } from "@/lib/server/responses";

export async function GET(_request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  return respond(await getInvoice((await ctx.params).id));
}

export async function PUT(request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const body = await readBody(request);
  const input = parseInvoiceInput(body);
  if (!input.ok) return respond(input);
  const activityId = parseActivityId(body);
  if (!activityId.ok) return respond(activityId);
  return respond(await replaceInvoice((await ctx.params).id, input.value, activityId.value));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  return respond(await deleteInvoice((await ctx.params).id));
}
