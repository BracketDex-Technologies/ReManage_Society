import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Length } from "class-validator";
import type { MobileRole } from "../../common/mobile-role.ts";
import type { PermissionAction } from "../../../../../../packages/security/src/index.ts";

export class MobileSessionIssueDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ format: "date-time" })
  accessExpiresAt!: string;

  @ApiProperty()
  renewableCredential!: string;

  @ApiProperty({ format: "date-time" })
  renewableExpiresAt!: string;

  @ApiProperty()
  deviceSessionId!: string;

  @ApiProperty({ enum: ["resident", "guard"] })
  activeRole!: MobileRole;
}

export class RefreshMobileSessionDto {
  @ApiProperty()
  @IsString()
  @Length(40, 512)
  renewableCredential!: string;
}

export class LogoutMobileSessionDto {
  @ApiProperty()
  @IsString()
  @Length(40, 512)
  renewableCredential!: string;
}

export class MobileBootstrapDto {
  user!: { id: string; name: string; email: string };
  society!: { id: string; name: string };
  approvedRoles!: MobileRole[];
  activeRole!: MobileRole;
  permissions!: PermissionAction[];
  featureFlags!: { residentShell: boolean; guardShell: boolean; nativePush: false; guardOffline: false };
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
  accessToken!: string;
  accessExpiresAt!: string;
  bootstrap!: MobileBootstrapDto;
}
