import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { AmenityService } from "./amenity.service.js";

interface CreateAmenityBody {
  societyId: string;
  name: string;
  category?: string;
  capacity?: number;
  ratePerHour?: number;
  rules?: string;
}

interface UpsertPolicyBody {
  societyId: string;
  amenityId: string;
  bookingWindowDays?: number;
  maxHoursPerBooking?: number;
  cooldownHours?: number;
  cancellationCutoffHours?: number;
  guestLimit?: number;
  requiresApproval?: boolean;
}

interface AddScheduleBody {
  societyId: string;
  amenityId: string;
  startTime: string;
  endTime: string;
  scheduleType?: string;
  dayOfWeek?: number;
  date?: string;
}

interface CreateBookingBody {
  societyId: string;
  facilityId: string;
  amenityId?: string;
  bookedBy: string;
  flatNumber: string;
  personId?: string;
  unitOccupancyId?: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  now?: string;
}

interface CancelBookingBody {
  societyId: string;
  bookingId: string;
  now?: string;
}

interface JoinWaitlistBody {
  societyId: string;
  facilityId: string;
  userId: string;
  flatNumber: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface BookingListBody {
  societyId: string;
  facilityId?: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations/amenities")
export class AmenityController {
  constructor(private readonly amenities: AmenityService) {}

  @Post("create")
  @ApiOkResponse({ description: "Creates an amenity." })
  createAmenity(@Req() request: AuthenticatedApiRequest, @Body() body: CreateAmenityBody) {
    return this.amenities.createAmenity(this.requirePrincipal(request), body);
  }

  @Post("policy")
  @ApiOkResponse({ description: "Upserts an amenity booking policy." })
  upsertPolicy(@Req() request: AuthenticatedApiRequest, @Body() body: UpsertPolicyBody) {
    return this.amenities.upsertPolicy(this.requirePrincipal(request), body);
  }

  @Post("schedule")
  @ApiOkResponse({ description: "Adds an amenity schedule or blackout window." })
  addSchedule(@Req() request: AuthenticatedApiRequest, @Body() body: AddScheduleBody) {
    return this.amenities.addSchedule(this.requirePrincipal(request), {
      societyId: body.societyId,
      amenityId: body.amenityId,
      startTime: body.startTime,
      endTime: body.endTime,
      scheduleType: body.scheduleType,
      dayOfWeek: body.dayOfWeek,
      date: body.date ? new Date(body.date) : undefined,
    });
  }

  @Post("bookings/create")
  @ApiOkResponse({ description: "Creates an amenity booking after policy validation." })
  createBooking(@Req() request: AuthenticatedApiRequest, @Body() body: CreateBookingBody) {
    return this.amenities.createBooking(this.requirePrincipal(request), {
      societyId: body.societyId,
      facilityId: body.facilityId,
      amenityId: body.amenityId,
      bookedBy: body.bookedBy,
      flatNumber: body.flatNumber,
      personId: body.personId,
      unitOccupancyId: body.unitOccupancyId,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      purpose: body.purpose,
      now: body.now ? new Date(body.now) : new Date(),
    });
  }

  @Post("bookings/cancel")
  @ApiOkResponse({ description: "Cancels an amenity booking within the cutoff window." })
  cancelBooking(@Req() request: AuthenticatedApiRequest, @Body() body: CancelBookingBody) {
    return this.amenities.cancelBooking(this.requirePrincipal(request), {
      societyId: body.societyId,
      bookingId: body.bookingId,
      now: body.now ? new Date(body.now) : new Date(),
    });
  }

  @Post("waitlist/join")
  @ApiOkResponse({ description: "Joins the amenity waitlist for a slot." })
  joinWaitlist(@Req() request: AuthenticatedApiRequest, @Body() body: JoinWaitlistBody) {
    return this.amenities.joinWaitlist(this.requirePrincipal(request), {
      societyId: body.societyId,
      facilityId: body.facilityId,
      userId: body.userId,
      flatNumber: body.flatNumber,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
    });
  }

  @Post("bookings/list")
  @ApiOkResponse({ description: "Lists amenity bookings." })
  listBookings(@Req() request: AuthenticatedApiRequest, @Body() body: BookingListBody) {
    return this.amenities.listBookings(this.requirePrincipal(request), body.societyId, body.facilityId);
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
