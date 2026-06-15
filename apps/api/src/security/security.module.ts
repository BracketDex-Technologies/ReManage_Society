import { Module } from "@nestjs/common";
import { AuthenticationGuard } from "./authentication.guard.js";
import { AuditLogService } from "./audit-log.service.js";
import { CompositeJwtPrincipalVerifier } from "./composite-jwt-principal-verifier.service.js";
import { FileStoragePolicyService } from "./file-storage-policy.service.js";
import { KeycloakJwtPrincipalVerifier } from "./jwt-principal-verifier.service.js";
import { JWT_PRINCIPAL_VERIFIER } from "./jwt-principal-verifier.tokens.js";
import { NotificationFoundationService } from "./notification-foundation.service.js";
import { RateLimitService } from "./rate-limit.service.js";
import { SecurityPolicyService } from "./security-policy.service.js";

@Module({
  providers: [
    AuthenticationGuard,
    AuditLogService,
    FileStoragePolicyService,
    CompositeJwtPrincipalVerifier,
    KeycloakJwtPrincipalVerifier,
    {
      provide: JWT_PRINCIPAL_VERIFIER,
      useExisting: CompositeJwtPrincipalVerifier,
    },
    NotificationFoundationService,
    RateLimitService,
    SecurityPolicyService,
  ],
  exports: [
    AuthenticationGuard,
    AuditLogService,
    FileStoragePolicyService,
    CompositeJwtPrincipalVerifier,
    KeycloakJwtPrincipalVerifier,
    JWT_PRINCIPAL_VERIFIER,
    NotificationFoundationService,
    RateLimitService,
    SecurityPolicyService,
  ],
})
export class SecurityModule {}
