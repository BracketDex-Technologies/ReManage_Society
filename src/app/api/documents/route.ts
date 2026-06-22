import { getSession } from "@/lib/auth";
import { getResidentFlatForSession } from "@/lib/resident-flat";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  decodeDocumentCategory,
  encodeDocumentCategory,
  resolveDocumentVisibility,
  type DocumentScope,
} from "@society/community-core";


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
const COMMITTEE_ROLES = new Set(["chairman", "secretary", "treasurer"]);
const RESIDENT_ROLES = new Set(["member", "tenant"]);
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flat = RESIDENT_ROLES.has(session.role) ? await getResidentFlatForSession(session) : null;
  const documents = await prisma.document.findMany({
    where: { societyId: session!.societyId },
    orderBy: { createdAt: "desc" },
  });

  const visibleDocuments = documents
    .map((document) => {
      const decoded = decodeDocumentCategory(document.category);
      return {
        ...document,
        category: decoded.category,
        scope: decoded.scope,
        ownerRef: decoded.ownerRef,
      };
    })
    .filter((document) =>
      resolveDocumentVisibility({
        scope: document.scope,
        ownerRef: document.ownerRef,
        viewer: {
          userId: session.userId,
          flatNumber: flat?.flatNumber,
          isManager: COMMITTEE_ROLES.has(session.role),
        },
      }),
    );

  return Response.json({ documents: visibleDocuments });
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
      if (file.size > MAX_DOCUMENT_BYTES) {
        return Response.json({ error: "Document must be under 20 MB" }, { status: 413 });
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
    if (fileSize && fileSize > MAX_DOCUMENT_BYTES) {
      return Response.json({ error: "Document must be under 20 MB" }, { status: 413 });
    }

    const scope: DocumentScope = RESIDENT_ROLES.has(session.role) ? "personal" : "society";
    const ownerRef = scope === "personal" ? session.userId : "society";

    const doc = await prisma.document.create({
      data: {
        societyId: session!.societyId,
        title,
        category: encodeDocumentCategory({
          category: category || "general",
          scope,
          ownerRef,
        }),
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
