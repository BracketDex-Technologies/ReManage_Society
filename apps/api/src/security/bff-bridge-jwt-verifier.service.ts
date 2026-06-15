import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  BFF_BRIDGE_ISSUER,
  verifyBffBridgeToken,
} from "../../../../packages/security/src/bff-bridge-token.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import type { JwtPrincipalVerifier } from "./jwt-principal-verifier.service.ts";

@Injectable()
export class BffBridgeJwtPrincipalVerifier implements JwtPrincipalVerifier {
  async verify(token: string): Promise<AuthenticatedPrincipal> {
    try {
      return await verifyBffBridgeToken(token);
    } catch {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Invalid BFF bridge bearer token",
        issuer: BFF_BRIDGE_ISSUER,
      });
    }
  }
}
