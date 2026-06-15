import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { normalizeJoinCode } from "@/lib/join-code";
import { ensureUnitForFlat } from "@/domain/unit-migration";
import { refreshUnitOccupancyStatus } from "@/domain/occupancy-lifecycle";
import { RELATIONSHIP_TYPES } from "@/domain/occupancy";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const RESIDENT_ROLES = ["member", "tenant"] as const;
type ResidentRole = (typeof RESIDENT_ROLES)[number];
type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

function isResidentRole(role: string): role is ResidentRole {
  return RESIDENT_ROLES.includes(role as ResidentRole);
}

function isRelationshipType(value: string): value is RelationshipType {
  return RELATIONSHIP_TYPES.includes(value as RelationshipType);
}

function relationshipToResidentRole(relationshipType: RelationshipType): ResidentRole {
  return relationshipType === "TENANT" ? "tenant" : "member";
}

function defaultBillingResponsibility(relationshipType: RelationshipType) {
  if (relationshipType === "TENANT") return "TENANT";
  return "OWNER";
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest) {
  try {
    const {
      joinCode,
      flatId,
      unitId,
      name,
      email,
      password,
      phone,
      role = "member",
      relationshipType,
      moveInDate,
      agreementEndDate,
      emergencyContact,
      isPrimaryOccupant,
      vehicleCount,
    } = await request.json();

    const cleanCode = normalizeJoinCode(joinCode || "");
    const cleanEmail = String(email || "").trim().toLowerCase();
    const requestedRelationship = String(
      relationshipType || (String(role).toLowerCase() === "tenant" ? "TENANT" : "OWNER")
    ).toUpperCase();

    if (!cleanCode || (!flatId && !unitId) || !name || !cleanEmail || !password) {
      return Response.json(
        { error: "Join code, unit, name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!isRelationshipType(requestedRelationship)) {
      return Response.json(
        { error: "Select a valid relationship with this unit" },
        { status: 400 }
      );
    }

    const cleanRole = relationshipToResidentRole(requestedRelationship);

    if (!isResidentRole(cleanRole)) {
      return Response.json({ error: "Invalid resident role" }, { status: 400 });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) {
      return Response.json({ error: "Email already registered" }, { status: 400 });
    }

    const society = await prisma.society.findUnique({
      where: { joinCode: cleanCode },
      select: { id: true, name: true },
    });

    if (!society) {
      return Response.json({ error: "Invalid join code" }, { status: 404 });
    }

    const flat = await prisma.flat.findFirst({
      where: {
        id: flatId || undefined,
        societyId: society.id,
        isActive: true,
      },
      include: { users: { select: { role: true } } },
    });

    const unit = unitId
      ? await prisma.unit.findFirst({
          where: { id: unitId, societyId: society.id, isActive: true },
        })
      : flat
        ? await ensureUnitForFlat(flat)
        : null;

    const legacyFlat = flat || (unit?.legacyFlatId
      ? await prisma.flat.findFirst({
          where: { id: unit.legacyFlatId, societyId: society.id, isActive: true },
          include: { users: { select: { role: true } } },
        })
      : null);

    if (!unit || !legacyFlat) {
      return Response.json(
        { error: "Selected unit does not belong to this society" },
        { status: 400 }
      );
    }

    const activeRelationships = await prisma.unitOccupancy.findMany({
      where: { unitId: unit.id, isActive: true, occupancyStatus: "ACTIVE" },
      select: { relationshipType: true, isPrimaryOccupant: true },
    });

    if (requestedRelationship === "OWNER" && activeRelationships.some((item) => item.relationshipType === "OWNER")) {
      return Response.json(
        { error: "This unit already has a primary owner. Use Co-owner or Family Member if applicable." },
        { status: 400 }
      );
    }

    if (requestedRelationship === "TENANT" && activeRelationships.some((item) => item.relationshipType === "TENANT")) {
      return Response.json({ error: "This unit already has an active tenant" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const cleanName = String(name).trim();
    const cleanPhone = phone ? String(phone).trim() : null;
    const cleanEmergencyContact = emergencyContact ? String(emergencyContact).trim() : null;
    const parsedMoveInDate = parseOptionalDate(moveInDate);
    const parsedAgreementEndDate = parseOptionalDate(agreementEndDate);
    const cleanVehicleCount = Math.max(0, Number(vehicleCount || 0) || 0);
    const shouldBePrimary =
      typeof isPrimaryOccupant === "boolean"
        ? isPrimaryOccupant
        : !activeRelationships.some((item) => item.isPrimaryOccupant);

    const user = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          societyId: society.id,
          name: cleanName,
          phone: cleanPhone,
          emergencyContact: cleanEmergencyContact,
        },
      });

      const created = await tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          phone: cleanPhone,
          role: cleanRole,
          societyId: society.id,
          flatId: legacyFlat.id,
          personId: person.id,
        },
      });

      if (shouldBePrimary) {
        await tx.unitOccupancy.updateMany({
          where: { unitId: unit.id, isActive: true, isPrimaryOccupant: true },
          data: { isPrimaryOccupant: false },
        });
      }

      await tx.unitOccupancy.create({
        data: {
          societyId: society.id,
          unitId: unit.id,
          personId: person.id,
          relationshipType: requestedRelationship,
          billingResponsibility: defaultBillingResponsibility(requestedRelationship),
          moveInDate: parsedMoveInDate,
          agreementEndDate: parsedAgreementEndDate,
          vehicleCount: cleanVehicleCount,
          isPrimaryOccupant: shouldBePrimary,
        },
      });

      if (["OWNER", "CO_OWNER"].includes(requestedRelationship)) {
        await tx.flat.update({
          where: { id: legacyFlat.id },
          data: {
            ownerName: legacyFlat.ownerName || cleanName,
            contact: legacyFlat.contact || cleanPhone,
            email: legacyFlat.email || cleanEmail,
            currentOccupant: legacyFlat.currentOccupant === "vacant" ? "owner" : legacyFlat.currentOccupant,
          },
        });
      } else if (requestedRelationship === "TENANT") {
        await tx.tenant.create({
          data: {
            flatId: legacyFlat.id,
            societyId: society.id,
            name: cleanName,
            phone: cleanPhone || "",
            email: cleanEmail,
            leaseStart: parsedMoveInDate || new Date(),
            leaseEnd: parsedAgreementEndDate,
            registeredBy: created.id,
            userId: created.id,
            status: "active",
          },
        });

        await tx.flat.update({
          where: { id: legacyFlat.id },
          data: {
            tenantName: legacyFlat.tenantName || cleanName,
            currentOccupant: "tenant",
          },
        });
      }

      return created;
    });

    await refreshUnitOccupancyStatus(unit.id);

    await createSession(user);

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        societyId: user.societyId,
        flatId: user.flatId,
      },
      society: { id: society.id, name: society.name },
      flat: { id: legacyFlat.id, flatNumber: legacyFlat.flatNumber },
      unit: { id: unit.id, flatNumber: unit.flatNumber },
    });
  } catch (error: unknown) {
    console.error("Join Error:", error);
    return Response.json(
      { error: "Could not join society. Please try again." },
      { status: 500 }
    );
  }
}
