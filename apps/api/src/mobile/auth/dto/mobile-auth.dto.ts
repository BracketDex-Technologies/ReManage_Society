import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MobileInstallationDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: ["android", "ios"] })
  @IsIn(["android", "ios"])
  platform!: "android" | "ios";

  @ApiProperty({ example: "1.0.0" })
  @IsString()
  @Length(1, 32)
  appVersion!: string;

  @ApiPropertyOptional({ example: "Pixel 9" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceName?: string;
}

export class PasswordLoginRequestDto {
  @ApiProperty({ format: "email" })
  @IsEmail()
  identifier!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 256)
  password!: string;

  @ApiProperty({ type: MobileInstallationDto })
  @ValidateNested()
  @Type(() => MobileInstallationDto)
  installation!: MobileInstallationDto;
}
