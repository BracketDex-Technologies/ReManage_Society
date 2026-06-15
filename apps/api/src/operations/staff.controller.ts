import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { StaffService } from "./staff.service.js";

interface StaffRegisterBody {
  societyId: string;
  name: string;
  phone: string;
  category: string;
  photoUrl?: string;
  idProofType?: string;
  idProofUrl?: string;
}

interface StaffFlatLinkBody {
  societyId: string;
  staffId: string;
  flatId: string;
  schedule?: string;
  agreedMonthlyPay?: number;
}

interface AttendanceCheckInBody {
  societyId: string;
  staffId: string;
  flatId?: string;
  checkIn: string;
  markedBy?: string;
  method?: string;
}

interface AttendanceCheckOutBody {
  societyId: string;
  attendanceId: string;
  checkOut: string;
}

interface StaffListBody {
  societyId: string;
}

interface AttendanceListBody {
  societyId: string;
  staffId?: string;
}

@ApiTags("operations")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/operations/staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post("register")
  @ApiOkResponse({ description: "Registers a domestic staff member." })
  register(@Req() request: AuthenticatedApiRequest, @Body() body: StaffRegisterBody) {
    return this.staff.registerStaff(this.requirePrincipal(request), body);
  }

  @Post("link-flat")
  @ApiOkResponse({ description: "Links a staff member to a flat." })
  linkFlat(@Req() request: AuthenticatedApiRequest, @Body() body: StaffFlatLinkBody) {
    return this.staff.linkStaffToFlat(this.requirePrincipal(request), body);
  }

  @Post("attendance/check-in")
  @ApiOkResponse({ description: "Marks a staff attendance check-in." })
  checkIn(@Req() request: AuthenticatedApiRequest, @Body() body: AttendanceCheckInBody) {
    return this.staff.markCheckIn(this.requirePrincipal(request), {
      societyId: body.societyId,
      staffId: body.staffId,
      flatId: body.flatId,
      checkIn: new Date(body.checkIn),
      markedBy: body.markedBy,
      method: body.method,
    });
  }

  @Post("attendance/check-out")
  @ApiOkResponse({ description: "Marks a staff attendance check-out." })
  checkOut(@Req() request: AuthenticatedApiRequest, @Body() body: AttendanceCheckOutBody) {
    return this.staff.markCheckOut(this.requirePrincipal(request), {
      societyId: body.societyId,
      attendanceId: body.attendanceId,
      checkOut: new Date(body.checkOut),
    });
  }

  @Post("list")
  @ApiOkResponse({ description: "Lists society staff." })
  list(@Req() request: AuthenticatedApiRequest, @Body() body: StaffListBody) {
    return this.staff.listStaff(this.requirePrincipal(request), body.societyId);
  }

  @Post("attendance/list")
  @ApiOkResponse({ description: "Lists staff attendance." })
  listAttendance(@Req() request: AuthenticatedApiRequest, @Body() body: AttendanceListBody) {
    return this.staff.listAttendance(this.requirePrincipal(request), body.societyId, body.staffId);
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
