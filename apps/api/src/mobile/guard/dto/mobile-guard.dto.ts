import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Length, Matches } from "class-validator";

export class RequestVisitorDto {
  @ApiProperty({ example: "A-308" })
  @IsString()
  @Length(1, 32)
  flatQuery!: string;

  @ApiProperty({ example: "Maya" })
  @IsString()
  @Length(1, 120)
  visitorName!: string;

  @ApiProperty({ example: "guest" })
  @IsString()
  @Length(1, 120)
  purpose!: string;

  @ApiPropertyOptional({ example: "+919876543210" })
  @IsOptional()
  @IsString()
  @Length(6, 24)
  phone?: string;

  @ApiPropertyOptional({ example: "MH 12 AB 1234" })
  @IsOptional()
  @IsString()
  @Length(1, 32)
  vehicleNo?: string;

  @ApiPropertyOptional({ example: "4829" })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/)
  passcode?: string;
}

export class VerifyVisitorPasscodeDto {
  @ApiProperty({ example: "4829" })
  @IsString()
  @Matches(/^\d{4,8}$/)
  passcode!: string;
}

export class MobileGuardVisitorDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  flatNumber!: string;

  @ApiProperty()
  visitorName!: string;

  @ApiProperty()
  purpose!: string;

  @ApiProperty({ enum: ["expected", "inside", "exited", "rejected", "cancelled"] })
  status!: string;

  @ApiPropertyOptional()
  residentResponse?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  vehicleNo?: string | null;

  @ApiProperty()
  arrivedAt!: string;

  @ApiPropertyOptional()
  entryTime?: string | null;

  @ApiPropertyOptional()
  exitTime?: string | null;
}

export class MobileGuardOverviewDto {
  @ApiProperty()
  expectedCount!: number;

  @ApiProperty()
  insideCount!: number;
}

export class MobileGuardPasscodeResultDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  passcodeVerified!: true;
}
