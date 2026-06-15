import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { GovernanceService } from "./governance.service.js";

interface RecordMeetingBody {
  societyId: string;
  title: string;
  date: string;
  meetingType?: string;
  agenda: string;
  minutes: string;
  attendees?: string[];
  decisions?: string;
  recordedBy: string;
}

interface CreatePollBody {
  societyId: string;
  title: string;
  description?: string;
  options: string[];
  createdBy: string;
  closesAt?: string;
}

interface CastVoteBody {
  societyId: string;
  pollId: string;
  voterRef: string;
  optionIndex: number;
}

interface PollRefBody {
  societyId: string;
  pollId: string;
}

interface SocietyRefBody {
  societyId: string;
  status?: string;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}

  @Post("meetings/record")
  @ApiOkResponse({ description: "Records meeting minutes with agenda, attendance, and decisions." })
  recordMeeting(@Req() request: AuthenticatedApiRequest, @Body() body: RecordMeetingBody) {
    return this.governance.recordMeeting(this.requirePrincipal(request), {
      societyId: body.societyId,
      title: body.title,
      date: new Date(body.date),
      meetingType: body.meetingType,
      agenda: body.agenda,
      minutes: body.minutes,
      attendees: body.attendees,
      decisions: body.decisions,
      recordedBy: body.recordedBy,
    });
  }

  @Post("meetings/list")
  @ApiOkResponse({ description: "Lists recorded meetings." })
  listMeetings(@Req() request: AuthenticatedApiRequest, @Body() body: SocietyRefBody) {
    return this.governance.listMeetings(this.requirePrincipal(request), body.societyId);
  }

  @Post("polls/create")
  @ApiOkResponse({ description: "Creates a poll with validated options." })
  createPoll(@Req() request: AuthenticatedApiRequest, @Body() body: CreatePollBody) {
    return this.governance.createPoll(this.requirePrincipal(request), {
      societyId: body.societyId,
      title: body.title,
      description: body.description,
      options: body.options,
      createdBy: body.createdBy,
      closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
    });
  }

  @Post("polls/vote")
  @ApiOkResponse({ description: "Casts a single vote per voter on an open poll." })
  vote(@Req() request: AuthenticatedApiRequest, @Body() body: CastVoteBody) {
    return this.governance.castVote(this.requirePrincipal(request), {
      societyId: body.societyId,
      pollId: body.pollId,
      voterRef: body.voterRef,
      optionIndex: body.optionIndex,
      now: new Date(),
    });
  }

  @Post("polls/close")
  @ApiOkResponse({ description: "Closes a poll for voting." })
  closePoll(@Req() request: AuthenticatedApiRequest, @Body() body: PollRefBody) {
    return this.governance.closePoll(this.requirePrincipal(request), body.societyId, body.pollId);
  }

  @Post("polls/results")
  @ApiOkResponse({ description: "Returns poll tally results." })
  results(@Req() request: AuthenticatedApiRequest, @Body() body: PollRefBody) {
    return this.governance.getPollResults(this.requirePrincipal(request), body.societyId, body.pollId);
  }

  @Post("polls/list")
  @ApiOkResponse({ description: "Lists polls with current tallies." })
  listPolls(@Req() request: AuthenticatedApiRequest, @Body() body: SocietyRefBody) {
    return this.governance.listPolls(this.requirePrincipal(request), body.societyId, body.status);
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
