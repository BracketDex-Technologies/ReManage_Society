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

const LEGACY_ROUTE = "/api/members/[id]";
const NEST_GET = "/api/v1/society-core/members/detail/get";
const NEST_PATCH = "/api/v1/society-core/members/detail/update";
const NEST_DELETE = "/api/v1/society-core/members/detail/remove";

async function legacyGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const member = await prisma.flat.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!member) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  return Response.json({ member });
}

async function legacyPUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Check member exists and belongs to this society
  const existing = await prisma.flat.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!existing) {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }

  // Check for duplicate flat number if changed
  if (body.flatNumber && body.flatNumber !== existing.flatNumber) {
    const duplicate = await prisma.flat.findFirst({
      where: {
        societyId: session!.societyId,
        flatNumber: body.flatNumber,
        id: { not: id },
      },
    });
    if (duplicate) {
      return Response.json(
        { error: `Flat number ${body.flatNumber} already exists` },
        { status: 400 }
      );
    }
  }

  const member = await prisma.flat.update({
    where: { id },
    data: {
      flatNumber: body.flatNumber ?? existing.flatNumber,
      wing: body.wing ?? existing.wing,
      floor: body.floor !== undefined ? (body.floor ? parseInt(body.floor) : null) : existing.floor,
      ownerName: body.ownerName ?? existing.ownerName,
      tenantName: body.tenantName ?? existing.tenantName,
      contact: body.contact ?? existing.contact,
      email: body.email ?? existing.email,
      vehicleNumber: body.vehicleNumber ?? existing.vehicleNumber,
      isActive: body.isActive ?? existing.isActive,
    },
  });

  return Response.json({ member });
}

async function legacyDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Soft delete - set isActive to false
  await prisma.flat.update({
    where: { id },
    data: { isActive: false },
  });

  // Update society totalFlats
  const flatCount = await prisma.flat.count({
    where: { societyId: session!.societyId, isActive: true },
  });
  await prisma.society.update({
    where: { id: session!.societyId },
    data: { totalFlats: flatCount },
  });

  return Response.json({ success: true });
}

export const GET = shimOrFallback({ legacyRoute: "/api/members", nestPath: "/api/v1/society-core/directory/read", method: "GET" }, legacyGET);
export const PUT = shimOrFallback({ legacyRoute: "/api/members", nestPath: "/api/v1/society-core/directory/read", method: "PUT" }, legacyPUT);
export const DELETE = shimOrFallback({ legacyRoute: "/api/members", nestPath: "/api/v1/society-core/directory/read", method: "DELETE" }, legacyDELETE);
