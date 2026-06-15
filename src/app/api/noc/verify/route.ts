import { verifySocietyNoc } from "@/lib/noc-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const certificateNo = url.searchParams.get("certificateNo") || url.searchParams.get("cert") || "";
  const code = url.searchParams.get("code") || url.searchParams.get("verificationCode") || undefined;

  if (!certificateNo.trim()) {
    return Response.json({ error: "certificateNo is required" }, { status: 400 });
  }

  const result = await verifySocietyNoc(certificateNo.trim(), code);

  return Response.json(result, { status: result.valid ? 200 : 404 });
}
