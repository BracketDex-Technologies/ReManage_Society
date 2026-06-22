import { getSession } from "@/lib/auth";
import { getResidentFlatForSession } from "@/lib/resident-flat";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  decodeDocumentCategory,
  resolveDocumentVisibility,
  type DocumentScope,
} from "@society/community-core";

const COMMITTEE_ROLES = new Set(["chairman", "secretary", "treasurer"]);
const RESIDENT_ROLES = new Set(["member", "tenant"]);

async function getVisibleDocument(id: string) {
  const session = await getSession();
  if (!session?.societyId) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const document = await prisma.document.findFirst({
    where: { id, societyId: session.societyId },
  });

  if (!document) {
    return { response: Response.json({ error: "Document not found" }, { status: 404 }) };
  }

  const decoded = decodeDocumentCategory(document.category);
  const flat = RESIDENT_ROLES.has(session.role) ? await getResidentFlatForSession(session) : null;
  const canView = resolveDocumentVisibility({
    scope: decoded.scope,
    ownerRef: decoded.ownerRef,
    viewer: {
      userId: session.userId,
      flatNumber: flat?.flatNumber,
      isManager: COMMITTEE_ROLES.has(session.role),
    },
  });

  if (!canView) {
    return { response: Response.json({ error: "Document not found" }, { status: 404 }) };
  }

  return { session, document, decoded };
}

function dataUrlToResponse(fileUrl: string, fileName: string) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(fileUrl);
  if (!match) return null;

  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const raw = match[3] || "";
  const body = isBase64 ? Buffer.from(raw, "base64") : Buffer.from(decodeURIComponent(raw));
  const fallbackFileName = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\"]/g, "")
    .trim() || "document";
  const encodedFileName = encodeURIComponent(fileName);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

async function legacyGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getVisibleDocument(id);
  if (result.response) return result.response;

  const { document } = result;
  const dataResponse = dataUrlToResponse(document.fileUrl, document.fileName);
  if (dataResponse) return dataResponse;

  if (/^https?:\/\//i.test(document.fileUrl)) {
    return Response.redirect(document.fileUrl, 302);
  }

  return Response.json({ error: "Document file is not available for preview" }, { status: 404 });
}

function canDeleteDocument(input: {
  role: string;
  userId: string;
  scope: DocumentScope;
  ownerRef: string;
}) {
  if (input.scope === "personal") {
    return input.ownerRef === input.userId;
  }

  return input.role === "chairman" || input.role === "secretary";
}

async function legacyDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await getVisibleDocument(id);
  if (result.response) return result.response;

  if (
    !canDeleteDocument({
      role: result.session.role,
      userId: result.session.userId,
      scope: result.decoded.scope,
      ownerRef: result.decoded.ownerRef,
    })
  ) {
    return Response.json({ error: "You do not have permission to delete this document" }, { status: 403 });
  }

  await prisma.document.delete({ where: { id: result.document.id } });
  return Response.json({ success: true });
}

export const GET = legacyGET;
export const DELETE = legacyDELETE;
