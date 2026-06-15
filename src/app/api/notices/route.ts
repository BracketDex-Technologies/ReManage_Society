import { getSession } from "@/lib/auth";
import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logCreated } from "@/lib/activity-log";
import { broadcastNotification } from "@/lib/notifications";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/notices";
const NEST_LIST = "/api/v1/community/notices/list";
const NEST_CREATE = "/api/v1/community/notices/create";

async function legacyGET() {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isNestShimEnabled()) {
    const proxied = await proxyNestJson<unknown[]>({
      path: NEST_LIST,
      session,
      body: { societyId: session.societyId, activeOnly: false },
    });

    if (proxied.ok) {
      return jsonWithHeaders(
        { notices: proxied.data },
        {
          status: 200,
          extraHeaders: {
            ...buildDeprecationHeaders({
              routePath: LEGACY_ROUTE,
              successorPath: NEST_LIST,
            }),
            ...passThroughRateLimitHeaders(proxied.headers),
          },
        },
      );
    }
  }

  const notices = await prisma.notice.findMany({
    where: { societyId: session.societyId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  return jsonWithHeaders(
    { notices },
    {
      status: 200,
      extraHeaders: buildDeprecationHeaders({
        routePath: LEGACY_ROUTE,
        successorPath: NEST_LIST,
      }),
    },
  );
}

async function legacyPOST(request: NextRequest) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, body: noticeBody, category, isPinned, expiresAt } = body;

    if (!title || !noticeBody) {
      return Response.json({ error: "Title and body are required" }, { status: 400 });
    }

    if (isNestShimEnabled()) {
      const proxied = await proxyNestJson<{
        created?: boolean;
        noticeId?: string;
        category?: string;
      }>({
        path: NEST_CREATE,
        session,
        body: {
          societyId: session.societyId,
          title,
          body: noticeBody,
          category: category || "general",
          postedBy: session.name,
          isPinned: isPinned || false,
          expiresAt: expiresAt || undefined,
        },
      });

      if (proxied.ok && proxied.data.noticeId) {
        return jsonWithHeaders(
          {
            notice: {
              id: proxied.data.noticeId,
              societyId: session.societyId,
              title,
              body: noticeBody,
              category: proxied.data.category || category || "general",
              postedBy: session.name,
              isPinned: isPinned || false,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
          },
          {
            status: 201,
            extraHeaders: {
              ...buildDeprecationHeaders({
                routePath: LEGACY_ROUTE,
                successorPath: NEST_CREATE,
              }),
              ...passThroughRateLimitHeaders(proxied.headers),
            },
          },
        );
      }
    }

    const notice = await prisma.notice.create({
      data: {
        societyId: session.societyId,
        title,
        body: noticeBody,
        category: category || "general",
        postedBy: session.name,
        isPinned: isPinned || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await logCreated("notice", notice.id, title, { category, isPinned });
    await broadcastNotification(
      session.societyId,
      "notice_new",
      `New Notice: ${title}`,
      `${session.name} posted a new ${category || "general"} notice.`,
      "/notices",
    );

    return jsonWithHeaders(
      { notice },
      {
        status: 201,
        extraHeaders: buildDeprecationHeaders({
          routePath: LEGACY_ROUTE,
          successorPath: NEST_CREATE,
        }),
      },
    );
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export const GET = shimOrFallback({ legacyRoute: "/api/notices", nestPath: "/api/v1/community/notices", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/notices", nestPath: "/api/v1/community/notices", method: "POST" }, legacyPOST);
