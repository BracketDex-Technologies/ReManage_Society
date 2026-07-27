import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";

export class RequestVisitorDto {
  @ApiProperty({ example: "A-308", type: String })
  @IsString()
  @Length(1, 32)
  flatQuery!: string;

  @ApiProperty({ example: "Maya", type: String })
  @IsString()
  @Length(1, 120)
  visitorName!: string;

  @ApiProperty({ example: "guest", type: String })
  @IsString()
  @Length(1, 120)
  purpose!: string;

  @ApiPropertyOptional({ example: "+919876543210", type: String })
  @IsOptional()
  @IsString()
  @Length(6, 24)
  phone?: string;

  @ApiPropertyOptional({ example: "MH 12 AB 1234", type: String })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  vehicleNo?: string;

  @ApiPropertyOptional({ example: "4829", type: String })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/)
  passcode?: string;
}

export class VerifyVisitorPasscodeDto {
  @ApiProperty({ example: "4829", type: String })
  @IsString()
  @Matches(/^\d{4,8}$/)
  passcode!: string;
}

export class MobileGuardVisitorDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  flatNumber!: string;

  @ApiProperty({ type: String })
  visitorName!: string;

  @ApiProperty({ type: String })
  purpose!: string;

  @ApiProperty({ type: String, enum: ["expected", "inside", "exited", "rejected", "cancelled"] })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  residentResponse?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  vehicleNo?: string | null;

  @ApiProperty({ type: String })
  arrivedAt!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  entryTime?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  exitTime?: string | null;
}

export class MobileGuardOverviewCountsDto {
  @ApiProperty({ type: Number })
  inside!: number;

  @ApiProperty({ type: Number })
  expected!: number;

  @ApiProperty({ type: Number })
  pendingApproval!: number;

  @ApiProperty({ type: Number })
  pendingParcels!: number;
}

export class MobileGuardOverviewDto {
  @ApiProperty({ type: String })
  gateLabel!: string;

  @ApiProperty({ type: () => MobileGuardOverviewCountsDto })
  counts!: MobileGuardOverviewCountsDto;
}

export class MobileGuardPasscodeResultDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: Boolean })
  passcodeVerified!: true;
}
