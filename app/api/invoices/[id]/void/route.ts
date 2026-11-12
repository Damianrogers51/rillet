import { voidInvoice } from "@/lib/server/invoice-store";
import { parseActivityId, readBody, respond } from "@/lib/server/responses";

export async function POST(request: Request, ctx: RouteContext<"/api/invoices/[id]/void">) {
  const activityId = parseActivityId(await readBody(request));
  if (!activityId.ok) return respond(activityId);
  return respond(await voidInvoice((await ctx.params).id, { activityId: activityId.value }));
}
