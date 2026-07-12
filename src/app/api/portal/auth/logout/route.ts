import { deletePortalSession } from "@/lib/portal-auth";

export async function POST() {
  await deletePortalSession();
  return Response.json({ ok: true });
}
