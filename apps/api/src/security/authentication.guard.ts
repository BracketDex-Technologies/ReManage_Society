import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { resolveTenantContext, TenantAccessError } from "../../../../packages/security/src/index.ts";
import type { AuthenticatedPrincipal, TenantContext } from "../../../../packages/security/src/index.ts";
import type { JwtPrincipalVerifier } from "./jwt-principal-verifier.service.ts";
import { JWT_PRINCIPAL_VERIFIER } from "./jwt-principal-verifier.tokens.js";

export interface AuthenticatedApiRequest {
  headers: Record<string, string | string[] | undefined>;
  principal?: AuthenticatedPrincipal;
  tenant?: TenantContext;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(JWT_PRINCIPAL_VERIFIER) private readonly verifier: JwtPrincipalVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedApiRequest>();
    const token = this.readBearerToken(request.headers.authorization);
    const societyId = this.readRequiredHeader(request.headers["x-society-id"], "x-society-id");
    const principal = await this.verifier.verify(token);

    try {
      request.principal = principal;
      request.tenant = resolveTenantContext(principal, societyId);
      return true;
    } catch (error) {
      if (error instanceof TenantAccessError) {
        throw new ForbiddenException({
          error: "forbidden",
          reason: error.message,
        });
      }

      throw error;
    }
  }

  private readBearerToken(value: string | string[] | undefined): string {
    const header = Array.isArray(value) ? value[0] : value;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Bearer token is required",
      });
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Bearer token is required",
      });
    }

    return token;
  }

  private readRequiredHeader(value: string | string[] | undefined, name: string): string {
    const header = Array.isArray(value) ? value[0] : value;
    if (!header?.trim()) {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: `${name} header is required`,
      });
    }

    return header.trim();
  }
}

