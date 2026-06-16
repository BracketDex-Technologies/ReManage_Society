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

function resolveOccupancy(unit?: {
  occupancyStatus: string;
  occupancies: Array<{
    relationshipType: string;
    isPrimaryOccupant: boolean;
    billingResponsibility: string;
    person: {
      name: string;
      phone: string | null;
      users: Array<{ id: string; role: string; name: string }>;
    };
  }>;
} | null) {
  const active = unit?.occupancies || [];
  const tenant = active.find((item) => item.relationshipType === "TENANT");
  const owner = active.find((item) => ["OWNER", "CO_OWNER"].includes(item.relationshipType));
  const current = unit?.occupancyStatus === "TENANT_OCCUPIED" && tenant ? tenant : owner || tenant || null;

  return {
    currentOccupantName: current?.person.name || null,
    currentOccupantPhone: current?.person.phone || null,
    currentOccupantRole: current?.relationshipType || null,
    ownerName: owner?.person.name || null,
    ownerPhone: owner?.person.phone || null,
    tenantName: tenant?.person.name || null,
    tenantPhone: tenant?.person.phone || null,
    userIds: active.flatMap((item) => item.person.users.map((user) => user.id)),
  };
}

const flatOccupancyInclude = {
  units: {
    include: {
      occupancies: {
        where: { isActive: true, occupancyStatus: "ACTIVE" },
        include: {
          person: {
            include: {
              users: { select: { id: true, role: true, name: true } },
            },
          },
        },
      },
    },
    take: 1,
  },
} as const;

// Gate actions: visitor entry, exit, package logging, staff attendance
const LEGACY_ROUTE = "/api/guard/gate";
const NEST_GET = "/api/v1/operations/guard/gate/log";
const NEST_POST = "/api/v1/operations/guard/gate/entry";

async function legacyPOST(request: NextRequest) {
  try {
    const { guardId, action, ...payload } = await request.json();

    if (!guardId) {
      return Response.json(
        { error: "Guard ID required" },
        { status: 400 }
      );
    }

    const guard = await prisma.guardUser.findUnique({
      where: { id: guardId },
    });

    if (!guard || !guard.isActive) {
      return Response.json(
        { error: "Invalid guard" },
        { status: 401 }
      );
    }

    // =========================================================
    // VISITOR ENTRY
    // =========================================================

    if (action === "visitor_entry") {
      const {
        flatNumber,
        visitorName,
        phone,
        purpose,
        vehicleNo,
        vehiclePhotoUrl,
        entryMode,
      } = payload;

      if (!flatNumber || !visitorName) {
        return Response.json(
          { error: "Flat number and visitor name required" },
          { status: 400 }
        );
      }

      const flat = await prisma.flat.findFirst({
        where: {
          societyId: guard.societyId,
          flatNumber,
        },
        include: flatOccupancyInclude,
      });

      // Blacklist check
      if (phone) {
        const blacklisted = await prisma.blacklist.findFirst({
          where: {
            societyId: guard.societyId,
            phone,
            isActive: true,
          },
        });

        if (blacklisted) {
          return Response.json(
            {
              error: `⚠ BLOCKED: ${blacklisted.name} is blacklisted. Reason: ${blacklisted.reason}`,
              blocked: true,
            },
            { status: 403 }
          );
        }
      }

      const isDirectEntry = entryMode === "direct";

      const visitor = await prisma.visitor.create({
        data: {
          societyId: guard.societyId,

          flatId: flat?.id || null,
          flatNumber,

          visitorName,
          phone: phone || null,

          purpose: purpose || "guest",
          vehicleNo: vehicleNo || null,
          photoUrl: vehiclePhotoUrl || null,

          guardId: guard.id,

          verificationMethod: "manual",

          status: isDirectEntry ? "in" : "expected",
          entryTime: isDirectEntry ? new Date() : undefined,
          approvedBy: isDirectEntry ? guard.name : null,
          residentResponse: isDirectEntry ? "approved" : null,
          respondedAt: isDirectEntry ? new Date() : null,
        },
      });

      if (isDirectEntry) {
        return Response.json({
          visitor,
          message: `${visitorName} checked in for Flat ${flatNumber}`,
        });
      }

      // Notify flat users
      const occupancy = flat ? resolveOccupancy(flat.units[0]) : null;
      const flatUserIds = occupancy?.userIds?.length
        ? occupancy.userIds
        : flat
          ? (await prisma.user.findMany({
              where: { flatId: flat.id, role: { in: ["member", "tenant"] } },
              select: { id: true },
            })).map((user) => user.id)
          : [];

      if (flatUserIds.length) {
        await prisma.notification.createMany({
          data: flatUserIds.map((userId) => ({
            societyId: guard.societyId,
            userId,

            type: "visitor_entry",

            title: "Visitor waiting at gate",

            message: `${visitorName} is waiting at ${guard.gateAssignment || "the gate"} for Flat ${flatNumber}.`,

            link: `/my-visitors?approve=${visitor.id}`,
          })),
        });
      }

      return Response.json({
        visitor,
        message: flatUserIds.length
          ? `Approval request sent to Flat ${flatNumber}`
          : `${visitorName} logged successfully`,
      });
    }

    // =========================================================
    // PASSCODE VERIFY
    // =========================================================

    if (action === "verify_passcode") {
      const { passcode } = payload;

      if (!passcode) {
        return Response.json(
          { error: "Passcode required" },
          { status: 400 }
        );
      }

      const visitor = await prisma.visitor.findFirst({
        where: {
          societyId: guard.societyId,
          passcode,
          status: "expected",
        },
        include: {
          flat: {
            select: {
              flatNumber: true,
              ownerName: true,
            },
          },
        },
      });

      if (!visitor) {
        return Response.json(
          { error: "Invalid or expired passcode" },
          { status: 404 }
        );
      }

      const updated = await prisma.visitor.update({
        where: {
          id: visitor.id,
        },
        data: {
          status: "in",
          entryTime: new Date(),
          guardId: guard.id,
          verificationMethod: "passcode",
          approvedBy: guard.name,
        },
      });

      return Response.json({
        visitor: updated,
        message: `✅ ${visitor.visitorName} verified for Flat ${visitor.flatNumber}`,
      });
    }

    // =========================================================
    // VISITOR CHECK-IN AFTER APPROVAL
    // =========================================================

    if (action === "visitor_checkin") {
      const { visitorId } = payload;

      if (!visitorId) {
        return Response.json(
          { error: "Visitor ID required" },
          { status: 400 }
        );
      }

      const visitor = await prisma.visitor.findFirst({
        where: {
          id: visitorId,
          societyId: guard.societyId,
          residentResponse: "approved",
          status: "expected",
        },
      });

      if (!visitor) {
        return Response.json(
          { error: "Approved visitor not found" },
          { status: 404 }
        );
      }

      const updated = await prisma.visitor.update({
        where: {
          id: visitor.id,
        },
        data: {
          status: "in",
          entryTime: new Date(),
          guardId: guard.id,
          verificationMethod: visitor.isPreApproved
            ? "pre_approved"
            : "manual_approved",
        },
      });

      return Response.json({
        visitor: updated,
        message: `${visitor.visitorName} checked in successfully`,
      });
    }

    // =========================================================
    // VISITOR EXIT
    // =========================================================

    if (action === "visitor_exit") {
      const { visitorId } = payload;

      if (!visitorId) {
        return Response.json(
          { error: "Visitor ID required" },
          { status: 400 }
        );
      }

      const visitor = await prisma.visitor.findUnique({
        where: {
          id: visitorId,
        },
      });

      if (!visitor) {
        return Response.json(
          { error: "Visitor not found" },
          { status: 404 }
        );
      }

      const updated = await prisma.visitor.update({
        where: {
          id: visitorId,
        },
        data: {
          status: "out",
          exitTime: new Date(),
        },
      });

      return Response.json({
        visitor: updated,
        message: "Visitor exit recorded",
      });
    }

    // =========================================================
    // STAFF CHECK-IN / CHECK-OUT
    // =========================================================

    if (action === "staff_checkin") {
      const { entryCode } = payload;

      if (!entryCode) {
        return Response.json(
          { error: "Entry code required" },
          { status: 400 }
        );
      }

      const staff = await prisma.domesticStaff.findFirst({
        where: {
          societyId: guard.societyId,
          entryCode,
          isActive: true,
        },
      });

      if (!staff) {
        return Response.json(
          { error: "Invalid entry code" },
          { status: 404 }
        );
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const openEntry = await prisma.staffAttendance.findFirst({
        where: {
          staffId: staff.id,
          checkIn: {
            gte: today,
            lt: tomorrow,
          },
          checkOut: null,
        },
      });

      // CHECK OUT
      if (openEntry) {
        await prisma.staffAttendance.update({
          where: {
            id: openEntry.id,
          },
          data: {
            checkOut: new Date(),
          },
        });

        return Response.json({
          message: `${staff.name} checked OUT`,
          action: "checkout",
        });
      }

      // CHECK IN
      await prisma.staffAttendance.create({
        data: {
          staffId: staff.id,
          societyId: guard.societyId,
          markedBy: guard.id,
          method: "code",
        },
      });

      return Response.json({
        message: `${staff.name} checked IN`,
        action: "checkin",
      });
    }

    // =========================================================
    // PACKAGE LOGGING
    // =========================================================

    if (action === "log_package") {
      const {
        flatNumber,
        courierName,
        description,
      } = payload;

      if (!flatNumber) {
        return Response.json(
          { error: "Flat number required" },
          { status: 400 }
        );
      }

      const flat = await prisma.flat.findFirst({
        where: {
          societyId: guard.societyId,
          flatNumber,
        },
        include: flatOccupancyInclude,
      });

      if (!flat) {
        return Response.json(
          { error: "Flat not found" },
          { status: 404 }
        );
      }

      const pickupOtp = String(
        Math.floor(1000 + Math.random() * 9000)
      );

      const pkg = await prisma.package.create({
        data: {
          societyId: guard.societyId,
          flatId: flat.id,

          courierName: courierName || "Unknown",
          description: description || null,

          loggedBy: guard.name,

          pickupOtp,
          status: "received",
        },
      });

      const occupancy = resolveOccupancy(flat.units[0]);
      const flatUserIds = occupancy.userIds.length
        ? occupancy.userIds
        : (await prisma.user.findMany({
            where: { flatId: flat.id, role: { in: ["member", "tenant"] } },
            select: { id: true },
          })).map((user) => user.id);

      if (flatUserIds.length) {
        await prisma.notification.createMany({
          data: flatUserIds.map((userId) => ({
            societyId: guard.societyId,
            userId,
            type: "package_arrived",
            title: "Package Arrived",
            message: `Package from ${courierName || "unknown courier"} received at gate for Flat ${flatNumber}.`,
            link: "/packages",
          })),
        });
      }

      return Response.json({
        package: pkg,
        message: "Package logged successfully",
      });
    }

    if (action === "package_collected") {
      const { packageId, collectedBy } = payload;

      if (!packageId) {
        return Response.json(
          { error: "Package ID required" },
          { status: 400 }
        );
      }

      const pkg = await prisma.package.findFirst({
        where: {
          id: packageId,
          societyId: guard.societyId,
          status: { in: ["received", "notified"] },
        },
        include: { flat: { include: flatOccupancyInclude } },
      });

      if (!pkg) {
        return Response.json(
          { error: "Package not found or already closed" },
          { status: 404 }
        );
      }

      const updated = await prisma.package.update({
        where: { id: pkg.id },
        data: {
          status: "collected",
          collectedAt: new Date(),
          collectedBy: collectedBy || guard.name,
        },
      });

      const occupancy = resolveOccupancy(pkg.flat.units[0]);
      const flatUserIds = occupancy.userIds.length
        ? occupancy.userIds
        : (await prisma.user.findMany({
            where: { flatId: pkg.flatId, role: { in: ["member", "tenant"] } },
            select: { id: true },
          })).map((user) => user.id);

      if (flatUserIds.length) {
        await prisma.notification.createMany({
          data: flatUserIds.map((userId) => ({
            societyId: guard.societyId,
            userId,
            type: "package_collected",
            title: "Package Collected",
            message: `${pkg.courierName || "Package"} for Flat ${pkg.flat.flatNumber} was marked collected at ${guard.gateAssignment || "the gate"}.`,
            link: "/packages",
          })),
        });
      }

      return Response.json({
        package: updated,
        message: "Package marked as collected",
      });
    }

    return Response.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Gate action error:", error);

    return Response.json(
      { error: "Action failed" },
      { status: 500 }
    );
  }
}

// =========================================================
// GET GATE DASHBOARD DATA
// =========================================================

async function legacyGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const guardId = searchParams.get("guardId");

    if (!guardId) {
      return Response.json(
        { error: "Guard ID required" },
        { status: 400 }
      );
    }

    const guard = await prisma.guardUser.findUnique({
      where: {
        id: guardId,
      },
    });

    if (!guard) {
      return Response.json(
        { error: "Guard not found" },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const showAll = searchParams.get("history") === "all";
    const visitorWindow = showAll ? {} : { createdAt: { gte: today } };
    const packageWindow = showAll ? {} : { createdAt: { gte: today } };

    const [
      visitorsIn,
      todayVisitors,
      expectedVisitors,
      pendingApproval,
      pendingPackages,
      todayStaff,
    ] = await Promise.all([
      prisma.visitor.count({
        where: {
          societyId: guard.societyId,
          status: "in",
        },
      }),

      prisma.visitor.count({
        where: {
          societyId: guard.societyId,
          entryTime: {
            gte: today,
          },
        },
      }),

      prisma.visitor.count({
        where: {
          societyId: guard.societyId,
          status: "expected",
          residentResponse: "approved",
        },
      }),

      prisma.visitor.count({
        where: {
          societyId: guard.societyId,
          status: "expected",
          residentResponse: null,
        },
      }),

      prisma.package.count({
        where: {
          societyId: guard.societyId,
          status: "received",
        },
      }),

      prisma.staffAttendance.count({
        where: {
          societyId: guard.societyId,
          checkIn: {
            gte: today,
          },
        },
      }),
    ]);

    const visitors = await prisma.visitor.findMany({
      where: {
        societyId: guard.societyId,
        ...visitorWindow,
      },
      include: { flat: { include: flatOccupancyInclude } },
      orderBy: [{ createdAt: "desc" }],
      take: showAll ? 100 : 30,
    });

    const packages = await prisma.package.findMany({
      where: {
        societyId: guard.societyId,
        ...packageWindow,
      },
      include: {
        flat: {
          include: flatOccupancyInclude,
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: showAll ? 100 : 30,
    });

    const flats = await prisma.flat.findMany({
      where: { societyId: guard.societyId, isActive: true },
      include: flatOccupancyInclude,
      orderBy: [{ wing: "asc" }, { floor: "asc" }, { flatNumber: "asc" }],
    });

    return Response.json({
      stats: {
        visitorsIn,
        todayVisitors,
        expectedVisitors,
        pendingApproval,
        pendingPackages,
        todayStaff,
      },

      visitors: visitors.map((visitor) => {
        const occupancy = visitor.flat ? resolveOccupancy(visitor.flat.units[0]) : null;
        return {
          ...visitor,
          flat: visitor.flat
            ? {
                flatNumber: visitor.flat.flatNumber,
                wing: visitor.flat.wing,
                ownerName: occupancy?.ownerName || visitor.flat.ownerName || null,
                tenantName: occupancy?.tenantName || visitor.flat.tenantName || null,
                currentOccupantName: occupancy?.currentOccupantName || visitor.flat.tenantName || visitor.flat.ownerName || null,
                currentOccupantRole: occupancy?.currentOccupantRole || null,
              }
            : null,
        };
      }),
      packages: packages.map((pkg) => {
        const occupancy = resolveOccupancy(pkg.flat.units[0]);
        return {
          ...pkg,
          flat: {
            flatNumber: pkg.flat.flatNumber,
            wing: pkg.flat.wing,
            ownerName: occupancy.ownerName || pkg.flat.ownerName || null,
            tenantName: occupancy.tenantName || pkg.flat.tenantName || null,
            currentOccupantName: occupancy.currentOccupantName || pkg.flat.tenantName || pkg.flat.ownerName || null,
            currentOccupantRole: occupancy.currentOccupantRole || null,
          },
        };
      }),
      flats: flats.map((flat) => {
        const occupancy = resolveOccupancy(flat.units[0]);
        return {
          id: flat.id,
          flatNumber: flat.flatNumber,
          wing: flat.wing,
          floor: flat.floor,
          ownerName: occupancy.ownerName || flat.ownerName || null,
          tenantName: occupancy.tenantName || flat.tenantName || null,
          currentOccupantName: occupancy.currentOccupantName || flat.tenantName || flat.ownerName || null,
          currentOccupantPhone: occupancy.currentOccupantPhone || null,
          currentOccupantRole: occupancy.currentOccupantRole || null,
        };
      }),
    });
  } catch (error) {
    console.error("Gate dashboard error:", error);

    return Response.json(
      { error: "Failed to fetch gate data" },
      { status: 500 }
    );
  }
}

export const POST = shimOrFallback(
  { legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "POST", requireAuth: false },
  legacyPOST,
);
export const GET = shimOrFallback(
  { legacyRoute: "/api/guard", nestPath: "/api/v1/operations", method: "GET", requireAuth: false },
  legacyGET,
);
