import { Module } from "@nestjs/common";
import { SecurityModule } from "../security/security.module.js";
import { DocumentController } from "./document.controller.js";
import { DocumentRepository } from "./document.repository.js";
import { DocumentService } from "./document.service.js";
import { EventController } from "./event.controller.js";
import { EventRepository } from "./event.repository.js";
import { EventService } from "./event.service.js";
import { ForumController } from "./forum.controller.js";
import { ForumRepository } from "./forum.repository.js";
import { ForumService } from "./forum.service.js";
import { GovernanceController } from "./governance.controller.js";
import { GovernanceRepository } from "./governance.repository.js";
import { GovernanceService } from "./governance.service.js";
import { HelpdeskController } from "./helpdesk.controller.js";
import { HelpdeskRepository } from "./helpdesk.repository.js";
import { HelpdeskService } from "./helpdesk.service.js";
import { MarketplaceController } from "./marketplace.controller.js";
import { MarketplaceRepository } from "./marketplace.repository.js";
import { MarketplaceService } from "./marketplace.service.js";
import { NoticeController } from "./notice.controller.js";
import { NoticeRepository } from "./notice.repository.js";
import { NoticeService } from "./notice.service.js";

@Module({
  imports: [SecurityModule],
  controllers: [
    NoticeController,
    HelpdeskController,
    DocumentController,
    GovernanceController,
    EventController,
    ForumController,
    MarketplaceController,
  ],
  providers: [
    NoticeRepository,
    NoticeService,
    HelpdeskRepository,
    HelpdeskService,
    DocumentRepository,
    DocumentService,
    GovernanceRepository,
    GovernanceService,
    EventRepository,
    EventService,
    ForumRepository,
    ForumService,
    MarketplaceRepository,
    MarketplaceService,
  ],
  exports: [
    NoticeService,
    HelpdeskService,
    DocumentService,
    GovernanceService,
    EventService,
    ForumService,
    MarketplaceService,
  ],
})
export class CommunityModule {}
