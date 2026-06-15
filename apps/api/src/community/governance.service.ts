import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  GovernanceRepository,
  type CastVoteCommand,
  type CreatePollCommand,
  type RecordMeetingCommand,
} from "./governance.repository.js";

@Injectable()
export class GovernanceService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: GovernanceRepository = new GovernanceRepository(),
  ) {}

  async recordMeeting(principal: AuthenticatedPrincipal, command: RecordMeetingCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:governance.manage", command.societyId);
    return this.repository.recordMeeting(command);
  }

  async listMeetings(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listMeetings(societyId);
  }

  async createPoll(principal: AuthenticatedPrincipal, command: CreatePollCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:governance.manage", command.societyId);
    return this.repository.createPoll(command);
  }

  async castVote(principal: AuthenticatedPrincipal, command: CastVoteCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:vote.cast", command.societyId);
    return this.repository.castVote(command);
  }

  async closePoll(principal: AuthenticatedPrincipal, societyId: string, pollId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:governance.manage", societyId);
    return this.repository.closePoll(societyId, pollId);
  }

  async getPollResults(principal: AuthenticatedPrincipal, societyId: string, pollId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.getPollResults(societyId, pollId);
  }

  async listPolls(principal: AuthenticatedPrincipal, societyId: string, status?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listPolls(societyId, status);
  }
}
