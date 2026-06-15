import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { ForumService } from "./forum.service.js";

interface CreateThreadBody {
  societyId: string;
  authorId: string;
  title: string;
  content: string;
  category?: string;
}

interface ReplyThreadBody {
  societyId: string;
  threadId: string;
  authorId: string;
  content: string;
}

interface ModerateThreadBody {
  societyId: string;
  threadId: string;
  action: string;
}

interface ListThreadsBody {
  societyId: string;
  category?: string;
}

interface ListRepliesBody {
  societyId: string;
  threadId: string;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class ForumController {
  constructor(private readonly forum: ForumService) {}

  @Post("forum/threads/create")
  @ApiOkResponse({ description: "Creates a forum thread." })
  createThread(@Req() request: AuthenticatedApiRequest, @Body() body: CreateThreadBody) {
    return this.forum.createThread(this.requirePrincipal(request), body);
  }

  @Post("forum/threads/reply")
  @ApiOkResponse({ description: "Replies to a forum thread (blocked when locked)." })
  reply(@Req() request: AuthenticatedApiRequest, @Body() body: ReplyThreadBody) {
    return this.forum.replyThread(this.requirePrincipal(request), body);
  }

  @Post("forum/threads/moderate")
  @ApiOkResponse({ description: "Pins/locks a forum thread." })
  moderate(@Req() request: AuthenticatedApiRequest, @Body() body: ModerateThreadBody) {
    return this.forum.moderateThread(this.requirePrincipal(request), body);
  }

  @Post("forum/threads/list")
  @ApiOkResponse({ description: "Lists forum threads (pinned first)." })
  listThreads(@Req() request: AuthenticatedApiRequest, @Body() body: ListThreadsBody) {
    return this.forum.listThreads(this.requirePrincipal(request), body.societyId, body.category);
  }

  @Post("forum/threads/replies")
  @ApiOkResponse({ description: "Lists replies for a thread." })
  listReplies(@Req() request: AuthenticatedApiRequest, @Body() body: ListRepliesBody) {
    return this.forum.listReplies(this.requirePrincipal(request), body.societyId, body.threadId);
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
