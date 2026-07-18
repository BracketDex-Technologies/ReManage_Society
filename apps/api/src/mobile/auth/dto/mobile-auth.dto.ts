import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MobileInstallationDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  id!: string;

  @ApiProperty({ type: String, enum: ["android", "ios"] })
  @IsIn(["android", "ios"])
  platform!: "android" | "ios";

  @ApiProperty({ type: String, example: "1.0.0" })
  @IsString()
  @Length(1, 32)
  appVersion!: string;

  @ApiPropertyOptional({ type: String, example: "Pixel 9" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceName?: string;
}

export class PasswordLoginRequestDto {
  @ApiProperty({ type: String, format: "email" })
  @IsEmail()
  identifier!: string;

  @ApiProperty({ type: String })
  @IsString()
  @Length(1, 256)
  password!: string;

  @ApiProperty({ type: MobileInstallationDto })
  @ValidateNested()
  @Type(() => MobileInstallationDto)
  installation!: MobileInstallationDto;
}

export class OtpRequestDto {
  @ApiProperty({ type: String, format: "email" })
  @IsEmail()
  identifier!: string;

  @ApiProperty({ type: MobileInstallationDto })
  @ValidateNested()
  @Type(() => MobileInstallationDto)
  installation!: MobileInstallationDto;
}

export class OtpRequestAcceptedDto {
  @ApiProperty({ type: Boolean })
  accepted!: true;

  @ApiProperty({ type: String, format: "uuid" })
  challengeId!: string;
}

export class OtpVerifyDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  challengeId!: string;

  @ApiProperty({ type: String, pattern: "^\\d{6}$" })
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ type: MobileInstallationDto })
  @ValidateNested()
  @Type(() => MobileInstallationDto)
  installation!: MobileInstallationDto;
}
