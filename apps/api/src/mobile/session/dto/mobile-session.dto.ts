import { ApiProperty } from "@nestjs/swagger";
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
