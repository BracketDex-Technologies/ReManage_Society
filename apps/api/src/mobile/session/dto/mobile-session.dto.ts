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

export class LogoutMobileSessionResponseDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  loggedOut!: true;
}

export class MobileBootstrapUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String, format: "email" })
  email!: string;
}

export class MobileBootstrapSocietyDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class MobileFeatureFlagsDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  residentShell!: true;

  @ApiProperty({ type: Boolean, enum: [true] })
  guardShell!: true;

  @ApiProperty({ type: Boolean, enum: [false] })
  nativePush!: false;

  @ApiProperty({ type: Boolean, enum: [false] })
  guardOffline!: false;
}

export class MobileCriticalNotificationPolicyDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  enabled!: true;

  @ApiProperty({ type: Boolean, enum: [false] })
  configurable!: false;
}

export class MobileTransactionalNotificationPolicyDto {
  @ApiProperty({ type: Boolean, enum: [true] })
  enabled!: true;

  @ApiProperty({ type: Boolean, enum: [true] })
  configurable!: true;
}

export class MobileCommunityNotificationPolicyDto {
  @ApiProperty({ type: Boolean, enum: [false] })
  enabled!: false;

  @ApiProperty({ type: Boolean, enum: [true] })
  configurable!: true;
}

export class MobileNotificationPolicyDto {
  @ApiProperty({ type: MobileCriticalNotificationPolicyDto })
  critical!: MobileCriticalNotificationPolicyDto;

  @ApiProperty({ type: MobileTransactionalNotificationPolicyDto })
  transactional!: MobileTransactionalNotificationPolicyDto;

  @ApiProperty({ type: MobileCommunityNotificationPolicyDto })
  community!: MobileCommunityNotificationPolicyDto;
}

export class MobileBootstrapDto {
  @ApiProperty({ type: MobileBootstrapUserDto })
  user!: MobileBootstrapUserDto;

  @ApiProperty({ type: MobileBootstrapSocietyDto })
  society!: MobileBootstrapSocietyDto;

  @ApiProperty({ enum: ["resident", "guard"], isArray: true })
  approvedRoles!: MobileRole[];

  @ApiProperty({ enum: ["resident", "guard"] })
  activeRole!: MobileRole;

  @ApiProperty({ type: String, isArray: true })
  permissions!: PermissionAction[];

  @ApiProperty({ type: MobileFeatureFlagsDto })
  featureFlags!: MobileFeatureFlagsDto;

  @ApiProperty({ type: MobileNotificationPolicyDto })
  notificationPolicy!: MobileNotificationPolicyDto;
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
