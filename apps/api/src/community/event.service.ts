import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  EventRepository,
  type CreateEventCommand,
  type RsvpCommand,
  type TransitionEventCommand,
} from "./event.repository.js";

@Injectable()
export class EventService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: EventRepository = new EventRepository(),
  ) {}

  async createEvent(principal: AuthenticatedPrincipal, command: CreateEventCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:governance.manage", command.societyId);
    return this.repository.createEvent(command);
  }

  async transitionEvent(principal: AuthenticatedPrincipal, command: TransitionEventCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:governance.manage", command.societyId);
    return this.repository.transitionEvent(command);
  }

  async rsvp(principal: AuthenticatedPrincipal, command: RsvpCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:rsvp.manage", command.societyId);
    return this.repository.rsvp(command);
  }

  async listEvents(principal: AuthenticatedPrincipal, societyId: string, status?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listEvents(societyId, status);
  }

  async listRsvps(principal: AuthenticatedPrincipal, societyId: string, eventId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listRsvps(eventId);
  }
}
