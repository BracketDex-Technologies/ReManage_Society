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
    const body = await request.json();
    const { title, category, fileName, fileUrl, fileSize } = body;

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
