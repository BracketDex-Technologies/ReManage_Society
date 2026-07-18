import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Length } from "class-validator";
import type { MobileRole } from "../../common/mobile-role.ts";
import type { PermissionAction } from "../../../../../../packages/security/src/index.ts";

export class MobileSessionIssueDto {
  @ApiProperty({ type: String })
  accessToken!: string;

  @ApiProperty({ type: String, format: "date-time" })
  accessExpiresAt!: string;

  @ApiProperty({ type: String })
  renewableCredential!: string;

  @ApiProperty({ type: String, format: "date-time" })
  renewableExpiresAt!: string;

  @ApiProperty({ type: String })
  deviceSessionId!: string;

  @ApiProperty({ enum: ["resident", "guard"] })
  activeRole!: MobileRole;
}

export class RefreshMobileSessionDto {
  @ApiProperty({ type: String })
  @IsString()
  @Length(40, 512)
  renewableCredential!: string;
}

export class LogoutMobileSessionDto {
  @ApiProperty({ type: String })
  @IsString()
  @Length(40, 512)
  renewableCredential!: string;
}

export class MobileBootstrapDto {
  @ApiProperty({ type: Object })
  user!: { id: string; name: string; email: string };

  @ApiProperty({ type: Object })
  society!: { id: string; name: string };

  @ApiProperty({ enum: ["resident", "guard"], isArray: true })
  approvedRoles!: MobileRole[];

  @ApiProperty({ enum: ["resident", "guard"] })
  activeRole!: MobileRole;

  @ApiProperty({ type: String, isArray: true })
  permissions!: PermissionAction[];

  @ApiProperty({ type: Object })
  featureFlags!: { residentShell: boolean; guardShell: boolean; nativePush: false; guardOffline: false };

  @ApiProperty({ type: Object })
  notificationPolicy!: {
    critical: { enabled: true; configurable: false };
    transactional: { enabled: true; configurable: true };
    community: { enabled: false; configurable: true };
  };
}

export class UpdateMobileActiveRoleDto {
  @ApiProperty({ enum: ["resident", "guard"] })
  @IsString()
  @IsIn(["resident", "guard"])
  role!: MobileRole;
}

export class MobileRoleSwitchDto {
  @ApiProperty({ type: String })
  accessToken!: string;

  @ApiProperty({ type: String, format: "date-time" })
  accessExpiresAt!: string;

  @ApiProperty({ type: MobileBootstrapDto })
  bootstrap!: MobileBootstrapDto;
}
