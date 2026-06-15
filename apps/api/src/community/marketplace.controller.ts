import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import type { ListingAction } from "../../../../packages/community-core/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { MarketplaceService } from "./marketplace.service.js";

interface CreateListingBody {
  societyId: string;
  userId: string;
  title: string;
  description?: string;
  price?: number;
  category?: string;
  condition?: string;
  privacyStatus?: string;
  contactPhone?: string;
  flatNumber?: string;
}

interface TransitionListingBody {
  societyId: string;
  listingId: string;
  action: ListingAction;
}

interface ExpressInterestBody {
  societyId: string;
  listingId: string;
  personId: string;
  message?: string;
}

interface ModerateListingBody {
  societyId: string;
  listingId: string;
  action: string;
  reason?: string;
  actorUserId?: string;
}

interface ListListingsBody {
  societyId: string;
  userId: string;
  includeAll?: boolean;
}

@ApiTags("community")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/community")
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Post("marketplace/listings/create")
  @ApiOkResponse({ description: "Creates a marketplace listing." })
  create(@Req() request: AuthenticatedApiRequest, @Body() body: CreateListingBody) {
    return this.marketplace.createListing(this.requirePrincipal(request), body);
  }

  @Post("marketplace/listings/transition")
  @ApiOkResponse({ description: "Reserves/sells/expires a listing." })
  transition(@Req() request: AuthenticatedApiRequest, @Body() body: TransitionListingBody) {
    return this.marketplace.transitionListing(this.requirePrincipal(request), body);
  }

  @Post("marketplace/listings/interest")
  @ApiOkResponse({ description: "Expresses idempotent interest in a listing." })
  interest(@Req() request: AuthenticatedApiRequest, @Body() body: ExpressInterestBody) {
    return this.marketplace.expressInterest(this.requirePrincipal(request), body);
  }

  @Post("marketplace/listings/moderate")
  @ApiOkResponse({ description: "Moderates a listing (approve/reject/report/archive)." })
  moderate(@Req() request: AuthenticatedApiRequest, @Body() body: ModerateListingBody) {
    return this.marketplace.moderateListing(this.requirePrincipal(request), body);
  }

  @Post("marketplace/listings/list")
  @ApiOkResponse({ description: "Lists visible listings with privacy-filtered contact details." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: ListListingsBody) {
    return this.marketplace.listListings(this.requirePrincipal(request), body);
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
