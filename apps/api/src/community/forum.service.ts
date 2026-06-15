import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  ForumRepository,
  type CreateThreadCommand,
  type ModerateThreadCommand,
  type ReplyThreadCommand,
} from "./forum.repository.js";

@Injectable()
export class ForumService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: ForumRepository = new ForumRepository(),
  ) {}

  async createThread(principal: AuthenticatedPrincipal, command: CreateThreadCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:post", command.societyId);
    return this.repository.createThread(command);
  }

  async replyThread(principal: AuthenticatedPrincipal, command: ReplyThreadCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:post", command.societyId);
    return this.repository.replyThread(command);
  }

  async moderateThread(principal: AuthenticatedPrincipal, command: ModerateThreadCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:moderate", command.societyId);
    return this.repository.moderateThread(command);
  }

  async listThreads(principal: AuthenticatedPrincipal, societyId: string, category?: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listThreads(societyId, category);
  }

  async listReplies(principal: AuthenticatedPrincipal, societyId: string, threadId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", societyId);
    return this.repository.listReplies(threadId);
  }
}
