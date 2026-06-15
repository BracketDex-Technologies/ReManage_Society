import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { NoticeService } from "./notice.service.js";

interface CreateNoticeBody {
  societyId: string;
  title: string;
  body: string;
  category?: string;
  postedBy: string;
  isPinned?: boolean;
  expiresAt?: string;
}

interface ListNoticesBody {
  societyId: string;
  category?: string;
  activeOnly?: boolean;
}

interface MarkReadBody {
  societyId: string;
  noticeId: string;
  userId: string;
  userName: string;
  flatNumber?: string;
  readAt?: string;
}

interface ReadReceiptsBody {
  societyId: string;
  noticeId: string;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class NoticeController {
  constructor(private readonly notices: NoticeService) {}

  @Post("notices/create")
  @ApiOkResponse({ description: "Publishes a society notice." })
  create(@Req() request: AuthenticatedApiRequest, @Body() body: CreateNoticeBody) {
    return this.notices.createNotice(this.requirePrincipal(request), {
      societyId: body.societyId,
      title: body.title,
      body: body.body,
      category: body.category,
      postedBy: body.postedBy,
      isPinned: body.isPinned,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Post("notices/list")
  @ApiOkResponse({ description: "Lists society notices (pinned first)." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: ListNoticesBody) {
    return this.notices.listNotices(this.requirePrincipal(request), {
      societyId: body.societyId,
      category: body.category,
      activeOnly: body.activeOnly,
      now: new Date(),
    });
  }

  @Post("notices/mark-read")
  @ApiOkResponse({ description: "Records an idempotent notice read receipt." })
  markRead(@Req() request: AuthenticatedApiRequest, @Body() body: MarkReadBody) {
    return this.notices.markRead(this.requirePrincipal(request), {
      societyId: body.societyId,
      noticeId: body.noticeId,
      userId: body.userId,
      userName: body.userName,
      flatNumber: body.flatNumber,
      readAt: body.readAt ? new Date(body.readAt) : undefined,
    });
  }

  @Post("notices/read-receipts")
  @ApiOkResponse({ description: "Lists read receipts for a notice (managers only)." })
  readReceipts(@Req() request: AuthenticatedApiRequest, @Body() body: ReadReceiptsBody) {
    return this.notices.listReadReceipts(
      this.requirePrincipal(request),
      body.societyId,
      body.noticeId,
    );
  }

  private requirePrincipal(request: AuthenticatedApiRequest): AuthenticatedPrincipal {
    if (!request.principal) {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Authenticated principal is required",
      });
    }

    return request.principal;
  }
}
