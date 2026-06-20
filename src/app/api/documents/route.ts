import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/documents";
const NEST_GET = "/api/v1/community/documents/list";
const NEST_POST = "/api/v1/community/documents/upload";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { societyId: session!.societyId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ documents });
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let title: string | undefined;
    let category: string | undefined;
    let fileName: string | undefined;
    let fileUrl: string | undefined;
    let fileSize: number | undefined;

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      title = String(formData.get("title") || "");
      category = String(formData.get("category") || "general");

      if (!(file instanceof File)) {
        return Response.json({ error: "A document file is required" }, { status: 400 });
      }
      if (file.size > 3_000_000) {
        return Response.json({ error: "Document must be under 3 MB" }, { status: 413 });
      }

      fileName = file.name;
      fileSize = file.size;
      const content = Buffer.from(await file.arrayBuffer()).toString("base64");
      fileUrl = `data:${file.type || "application/octet-stream"};base64,${content}`;
    } else {
      const body = await request.json();
      ({ title, category, fileName, fileUrl, fileSize } = body);
    }

    if (!title || !fileName || !fileUrl) {
      return Response.json({ error: "Title, filename and url are required" }, { status: 400 });
    }

    const doc = await prisma.document.create({
      data: {
        societyId: session!.societyId,
        title,
        category: category || "general",
        fileName,
        fileUrl,
        fileSize: fileSize || null,
        uploadedBy: session.name,
      },
    });

    return Response.json({ document: doc }, { status: 201 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/documents", nestPath: "/api/v1/community/documents", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/documents", nestPath: "/api/v1/community/documents", method: "POST" }, legacyPOST);
