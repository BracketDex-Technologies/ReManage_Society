import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  mapOidcClaimsToPrincipal,
  type AuthenticatedPrincipal,
} from "../../../../packages/security/src/index.ts";

export interface JwtPrincipalVerifier {
  verify(token: string): Promise<AuthenticatedPrincipal>;
}

@Injectable()
export class KeycloakJwtPrincipalVerifier implements JwtPrincipalVerifier {
  private readonly jwks = createRemoteJWKSet(
    new URL(process.env.KEYCLOAK_JWKS_URL || "http://localhost:8080/realms/society-connect/protocol/openid-connect/certs"),
  );

  async verify(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        audience: process.env.KEYCLOAK_CLIENT_ID || undefined,
        issuer: process.env.KEYCLOAK_ISSUER_URL || undefined,
      });

      return mapOidcClaimsToPrincipal(payload);
    } catch {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Invalid bearer token",
      });
    }
  }
}

