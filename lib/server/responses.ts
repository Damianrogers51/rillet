import "server-only";
import type { StoreResult } from "@/lib/server/invoice-store";

export function respond<T>(result: StoreResult<T>, successStatus = 200) {
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  if (result.value === null) return new Response(null, { status: 204 });
  return Response.json(result.value, { status: successStatus });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function parseActivityId(body: Record<string, unknown>): StoreResult<string> {
  const { activityId } = body;
  return typeof activityId === "string" && activityId
    ? { ok: true, value: activityId }
    : { ok: false, status: 422, error: "activityId is required" };
}
