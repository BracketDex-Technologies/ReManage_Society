import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { ParkingService } from "./parking.service.js";

interface CreateZoneBody {
  societyId: string;
  name: string;
  level?: string;
  wing?: string;
  description?: string;
}

interface CreateSlotBody {
  societyId: string;
  slotNumber: string;
  slotType?: string;
  zoneId?: string;
  level?: string;
  wing?: string;
}

interface AssignSlotBody {
  societyId: string;
  slotId: string;
  vehicleId?: string;
  unitOccupancyId?: string;
  assignmentType?: string;
  vehicleNo?: string;
  assignedBy?: string;
}

interface ReleaseSlotBody {
  societyId: string;
  slotId: string;
}

interface SlotListBody {
  societyId: string;
  zoneId?: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations/parking")
export class ParkingController {
  constructor(private readonly parking: ParkingService) {}

  @Post("zones/create")
  @ApiOkResponse({ description: "Creates a parking zone." })
  createZone(@Req() request: AuthenticatedApiRequest, @Body() body: CreateZoneBody) {
    return this.parking.createZone(this.requirePrincipal(request), body);
  }

  @Post("slots/create")
  @ApiOkResponse({ description: "Creates a parking slot." })
  createSlot(@Req() request: AuthenticatedApiRequest, @Body() body: CreateSlotBody) {
    return this.parking.createSlot(this.requirePrincipal(request), body);
  }

  @Post("slots/assign")
  @ApiOkResponse({ description: "Assigns a parking slot to a vehicle/occupancy." })
  assignSlot(@Req() request: AuthenticatedApiRequest, @Body() body: AssignSlotBody) {
    return this.parking.assignSlot(this.requirePrincipal(request), body);
  }

  @Post("slots/release")
  @ApiOkResponse({ description: "Releases a parking slot assignment." })
  releaseSlot(@Req() request: AuthenticatedApiRequest, @Body() body: ReleaseSlotBody) {
    return this.parking.releaseSlot(this.requirePrincipal(request), body);
  }

  @Post("slots/list")
  @ApiOkResponse({ description: "Lists parking slots." })
  listSlots(@Req() request: AuthenticatedApiRequest, @Body() body: SlotListBody) {
    return this.parking.listSlots(this.requirePrincipal(request), body.societyId, body.zoneId);
  }

  @Post("capacity")
  @ApiOkResponse({ description: "Summarizes parking capacity." })
  capacity(@Req() request: AuthenticatedApiRequest, @Body() body: SlotListBody) {
    return this.parking.capacity(this.requirePrincipal(request), body.societyId, body.zoneId);
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
