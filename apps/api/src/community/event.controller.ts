import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import type { EventAction } from "../../../../packages/community-core/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { EventService } from "./event.service.js";

interface CreateEventBody {
  societyId: string;
  organizerId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  venue?: string;
  category?: string;
  maxAttendees?: number;
}

interface TransitionEventBody {
  societyId: string;
  eventId: string;
  action: EventAction;
}

interface RsvpBody {
  societyId: string;
  eventId: string;
  userId: string;
  response?: string;
}

interface ListEventsBody {
  societyId: string;
  status?: string;
}

interface ListRsvpsBody {
  societyId: string;
  eventId: string;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class EventController {
  constructor(private readonly events: EventService) {}

  @Post("events/create")
  @ApiOkResponse({ description: "Creates a society event." })
  create(@Req() request: AuthenticatedApiRequest, @Body() body: CreateEventBody) {
    return this.events.createEvent(this.requirePrincipal(request), {
      societyId: body.societyId,
      organizerId: body.organizerId,
      title: body.title,
      description: body.description,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      venue: body.venue,
      category: body.category,
      maxAttendees: body.maxAttendees,
    });
  }

  @Post("events/transition")
  @ApiOkResponse({ description: "Transitions an event through its lifecycle." })
  transition(@Req() request: AuthenticatedApiRequest, @Body() body: TransitionEventBody) {
    return this.events.transitionEvent(this.requirePrincipal(request), body);
  }

  @Post("events/rsvp")
  @ApiOkResponse({ description: "Records an idempotent RSVP with capacity enforcement." })
  rsvp(@Req() request: AuthenticatedApiRequest, @Body() body: RsvpBody) {
    return this.events.rsvp(this.requirePrincipal(request), body);
  }

  @Post("events/list")
  @ApiOkResponse({ description: "Lists society events." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: ListEventsBody) {
    return this.events.listEvents(this.requirePrincipal(request), body.societyId, body.status);
  }

  @Post("events/rsvps")
  @ApiOkResponse({ description: "Lists RSVPs for an event." })
  rsvps(@Req() request: AuthenticatedApiRequest, @Body() body: ListRsvpsBody) {
    return this.events.listRsvps(this.requirePrincipal(request), body.societyId, body.eventId);
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
