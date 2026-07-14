import { Injectable } from "@nestjs/common";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { MobileConfigService } from "../common/mobile-config.service.ts";

const MOBILE_ACCESS_ISSUER = "remanage-mobile-api";
const MOBILE_ACCESS_AUDIENCE = "remanage-mobile-app";

export interface MobileAccessClaims {
  sub: string;
  sid: string;
  societyId: string;
  membershipId: string;
  activeRole: "resident" | "guard";
  activePermissionRole: string;
  version: number;
  type: "mobile_access";
}

@Injectable()
export class MobileAccessTokenService {
  constructor(private readonly config: MobileConfigService) {}

  async issue(claims: MobileAccessClaims): Promise<string> {
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(MOBILE_ACCESS_ISSUER)
      .setAudience(MOBILE_ACCESS_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.config.value.accessTokenTtlSeconds}s`)
      .sign(this.secret());
  }

  async verify(token: string): Promise<MobileAccessClaims> {
    const { payload } = await jwtVerify(token, this.secret(), {
      algorithms: ["HS256"],
      issuer: MOBILE_ACCESS_ISSUER,
      audience: MOBILE_ACCESS_AUDIENCE,
    });

    return readMobileAccessClaims(payload);
  }

  private secret(): Uint8Array {
    return new TextEncoder().encode(this.config.value.accessTokenSecret);
  }
}

function readMobileAccessClaims(payload: JWTPayload): MobileAccessClaims {
  if (payload.type !== "mobile_access") {
    throw new Error("JWT type must be mobile_access");
  }
  if (payload.activeRole !== "resident" && payload.activeRole !== "guard") {
    throw new Error("JWT activeRole must be a supported mobile role");
  }

  return {
    sub: requiredString(payload.sub, "sub"),
    sid: requiredString(payload.sid, "sid"),
    societyId: requiredString(payload.societyId, "societyId"),
    membershipId: requiredString(payload.membershipId, "membershipId"),
    activeRole: payload.activeRole,
    activePermissionRole: requiredString(
      payload.activePermissionRole,
      "activePermissionRole",
    ),
    version: requiredInteger(payload.version, "version"),
    type: "mobile_access",
  };
}

function requiredString(value: unknown, claim: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`JWT ${claim} must be a non-empty string`);
  }
  return value;
}

function requiredInteger(value: unknown, claim: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`JWT ${claim} must be an integer`);
  }
  return value;
}
