import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { AssetService } from "./asset.service.js";

interface CreateVendorBody {
  societyId: string;
  name: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  hasAMC?: boolean;
  amcStartDate?: string;
  amcEndDate?: string;
  amcAmount?: number;
}

interface CreateAssetBody {
  societyId: string;
  name: string;
  category: string;
  location?: string;
  purchaseDate?: string;
  purchaseAmount?: number;
  warrantyEnd?: string;
  condition?: string;
  lastMaintenanceAt?: string;
  maintenanceCycle?: number;
}

interface RecordMaintenanceBody {
  societyId: string;
  assetId: string;
  performedAt: string;
  maintenanceCycle?: number;
  condition?: string;
}

interface ListBody {
  societyId: string;
  now?: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations")
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Post("vendors/create")
  @ApiOkResponse({ description: "Creates a vendor." })
  createVendor(@Req() request: AuthenticatedApiRequest, @Body() body: CreateVendorBody) {
    return this.assets.createVendor(this.requirePrincipal(request), {
      societyId: body.societyId,
      name: body.name,
      category: body.category,
      contactPerson: body.contactPerson,
      phone: body.phone,
      email: body.email,
      gstNumber: body.gstNumber,
      hasAMC: body.hasAMC,
      amcStartDate: body.amcStartDate ? new Date(body.amcStartDate) : undefined,
      amcEndDate: body.amcEndDate ? new Date(body.amcEndDate) : undefined,
      amcAmount: body.amcAmount,
    });
  }

  @Post("vendors/list")
  @ApiOkResponse({ description: "Lists vendors with AMC status." })
  listVendors(@Req() request: AuthenticatedApiRequest, @Body() body: ListBody) {
    return this.assets.listVendors(
      this.requirePrincipal(request),
      body.societyId,
      body.now ? new Date(body.now) : new Date(),
    );
  }

  @Post("assets/create")
  @ApiOkResponse({ description: "Creates a society asset." })
  createAsset(@Req() request: AuthenticatedApiRequest, @Body() body: CreateAssetBody) {
    return this.assets.createAsset(this.requirePrincipal(request), {
      societyId: body.societyId,
      name: body.name,
      category: body.category,
      location: body.location,
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      purchaseAmount: body.purchaseAmount,
      warrantyEnd: body.warrantyEnd ? new Date(body.warrantyEnd) : undefined,
      condition: body.condition,
      lastMaintenanceAt: body.lastMaintenanceAt ? new Date(body.lastMaintenanceAt) : undefined,
      maintenanceCycle: body.maintenanceCycle,
    });
  }

  @Post("assets/record-maintenance")
  @ApiOkResponse({ description: "Records asset maintenance and schedules the next service." })
  recordMaintenance(@Req() request: AuthenticatedApiRequest, @Body() body: RecordMaintenanceBody) {
    return this.assets.recordMaintenance(this.requirePrincipal(request), {
      societyId: body.societyId,
      assetId: body.assetId,
      performedAt: new Date(body.performedAt),
      maintenanceCycle: body.maintenanceCycle,
      condition: body.condition,
    });
  }

  @Post("assets/due")
  @ApiOkResponse({ description: "Lists assets due for maintenance." })
  listDue(@Req() request: AuthenticatedApiRequest, @Body() body: ListBody) {
    return this.assets.listDueMaintenance(
      this.requirePrincipal(request),
      body.societyId,
      body.now ? new Date(body.now) : new Date(),
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
