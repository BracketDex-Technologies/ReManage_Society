import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/complaints/public";
const NEST_POST = "/api/v1/community/helpdesk/public/create";

async function legacyPOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { societyId, flatNumber, raisedBy, title, description, category, priority } = body;

    if (!societyId || !flatNumber || !raisedBy || !title || !description) {
      return NextResponse.json({ error: "All required fields must be provided" }, { status: 400 });
    }

    // Verify society exists
    const society = await prisma.society.findUnique({
      where: { id: societyId },
    });

    if (!society) {
      return NextResponse.json({ error: "Invalid society link" }, { status: 404 });
    }

    // Optional: Verify flat exists in society
    const flat = await prisma.flat.findFirst({
      where: { 
        societyId,
        flatNumber: {
          equals: flatNumber,
          mode: 'insensitive'
        }
      },
    });

    if (!flat) {
       // We can allow it even if flat is not registered yet, or be strict.
       // Let's be a bit flexible for now or just log it.
    }

    const complaint = await prisma.complaint.create({
      data: {
        societyId,
        flatNumber,
        raisedBy,
        title,
        description,
        category: category || "general",
        priority: priority || "medium",
      },
    });

    // Notify committee (without requiring session)
    // We can use the societyId from the request
    // Since we don't have a session, we'll use a generic "Member" or something if needed.
    
    return NextResponse.json({ 
      success: true, 
      id: complaint.id,
      message: "Complaint registered successfully" 
    }, { status: 201 });

  } catch (error) {
    console.error("Public complaint error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const POST = shimOrFallback(
  { legacyRoute: "/api/complaints", nestPath: "/api/v1/community/helpdesk", method: "POST", requireAuth: false },
  legacyPOST,
);
