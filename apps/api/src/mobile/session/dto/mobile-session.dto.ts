import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";
import type { MobileRole } from "../../common/mobile-role.ts";

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
