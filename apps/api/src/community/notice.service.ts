import { Injectable } from "@nestjs/common";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  NoticeRepository,
  type CreateNoticeCommand,
  type ListNoticesQuery,
  type MarkNoticeReadCommand,
} from "./notice.repository.js";

@Injectable()
export class NoticeService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: NoticeRepository = new NoticeRepository(),
  ) {}

  async createNotice(principal: AuthenticatedPrincipal, command: CreateNoticeCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:notice.manage", command.societyId);
    return this.repository.createNotice(command);
  }

  async listNotices(principal: AuthenticatedPrincipal, query: ListNoticesQuery) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", query.societyId);
    return this.repository.listNotices(query);
  }

  async markRead(principal: AuthenticatedPrincipal, command: MarkNoticeReadCommand) {
    this.securityPolicy.authorizeOrThrow(principal, "community:read", command.societyId);
    return this.repository.markRead(command);
  }

  async listReadReceipts(principal: AuthenticatedPrincipal, societyId: string, noticeId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "community:notice.manage", societyId);
    return this.repository.listReadReceipts(societyId, noticeId);
  }
}
