import { Injectable } from "@nestjs/common";
import { isBffBridgeEnabled } from "../../../../packages/security/src/bff-bridge-token.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { BffBridgeJwtPrincipalVerifier } from "./bff-bridge-jwt-verifier.service.js";
import type { JwtPrincipalVerifier } from "./jwt-principal-verifier.service.ts";
import { KeycloakJwtPrincipalVerifier } from "./jwt-principal-verifier.service.js";

@Injectable()
export class CompositeJwtPrincipalVerifier implements JwtPrincipalVerifier {
  constructor(
    private readonly bffBridge: JwtPrincipalVerifier = new BffBridgeJwtPrincipalVerifier(),
    private readonly keycloak: JwtPrincipalVerifier = new KeycloakJwtPrincipalVerifier(),
  ) {}

  async verify(token: string): Promise<AuthenticatedPrincipal> {
    if (isBffBridgeEnabled()) {
      try {
        return await this.bffBridge.verify(token);
      } catch {
        // Fall through to Keycloak for mixed client environments.
      }
    }

    return this.keycloak.verify(token);
  }
}
