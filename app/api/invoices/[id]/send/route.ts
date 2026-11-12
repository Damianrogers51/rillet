import { parseInvoiceInput, sendInvoice } from "@/lib/server/invoice-store";
import { parseActivityId, readBody, respond } from "@/lib/server/responses";

export async function POST(request: Request, ctx: RouteContext<"/api/invoices/[id]/send">) {
  const body = await readBody(request);
  const activityId = parseActivityId(body);
  if (!activityId.ok) return respond(activityId);
  const input = body.input === undefined ? undefined : parseInvoiceInput(body.input);
  if (input && !input.ok) return respond(input);
  return respond(await sendInvoice((await ctx.params).id, { activityId: activityId.value, input: input?.value }));
}
