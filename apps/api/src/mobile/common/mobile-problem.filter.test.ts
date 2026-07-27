import { BadRequestException, ForbiddenException, HttpException, HttpStatus, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

type ProblemBody = {
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
};

async function loadFilter(): Promise<
  | { MobileProblemFilter: new () => { catch: (exception: unknown, host: unknown) => void } }
  | null
> {
  try {
    return await import(new URL("./mobile-problem.filter.ts", import.meta.url).href) as {
      MobileProblemFilter: new () => { catch: (exception: unknown, host: unknown) => void };
    };
  } catch {
    return null;
  }
}

function captureProblem(Filter: new () => { catch: (exception: unknown, host: unknown) => void }, exception: unknown): { status: number; body: ProblemBody } {
  let status = 0;
  let body: ProblemBody | undefined;
  const response = {
    status(value: number) {
      status = value;
      return this;
    },
    type() {
      return this;
    },
    send(value: ProblemBody) {
      body = value;
    },
    getHeader(name: string) {
      return name === "x-request-id" ? "request-mobile-123" : undefined;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: "/api/mobile/v1/auth/password" }),
    }),
  };

  new Filter().catch(exception, host);

  if (!body) throw new Error("Mobile problem filter did not send a response");
  return { status, body };
}

describe("MobileProblemFilter", () => {
  it("uses the locked public problem shape for validation errors", async () => {
    const module = await loadFilter();
    expect(module).not.toBeNull();
    if (!module) return;

    const result = captureProblem(
      module.MobileProblemFilter,
      new BadRequestException({
        message: ["identifier must be an email", "installation.id must be a UUID"],
      }),
    );

    expect(result).toEqual({
      status: HttpStatus.BAD_REQUEST,
      body: {
        code: "validation_error",
        message: "Please correct the highlighted fields.",
        requestId: "request-mobile-123",
        fieldErrors: {
          identifier: ["must be an email"],
          "installation.id": ["must be a UUID"],
        },
      },
    });
  });

  it.each([
    [new UnauthorizedException({ error: "invalid_credentials" }), HttpStatus.UNAUTHORIZED, "invalid_credentials"],
    [new ForbiddenException({ error: "mobile_role_not_allowed" }), HttpStatus.FORBIDDEN, "forbidden"],
    [new HttpException({ error: "rate_limit_exceeded" }, HttpStatus.TOO_MANY_REQUESTS), HttpStatus.TOO_MANY_REQUESTS, "rate_limit_exceeded"],
    [new ServiceUnavailableException({ error: "mobile_api_disabled" }), HttpStatus.SERVICE_UNAVAILABLE, "mobile_api_disabled"],
  ])("maps known mobile domain errors without leaking internals", async (exception, expectedStatus, code) => {
    const module = await loadFilter();
    expect(module).not.toBeNull();
    if (!module) return;

    const result = captureProblem(module.MobileProblemFilter, exception);

    expect(result.status).toBe(expectedStatus);
    expect(result.body).toMatchObject({ code, requestId: "request-mobile-123" });
    expect(Object.keys(result.body).sort()).toEqual(["code", "message", "requestId"]);
  });

  it.each([
    ["flat_not_found", HttpStatus.NOT_FOUND],
    ["visitor_not_found", HttpStatus.NOT_FOUND],
    ["visitor_not_approved", HttpStatus.CONFLICT],
    ["visitor_not_inside", HttpStatus.CONFLICT],
    ["visitor_blacklisted", HttpStatus.FORBIDDEN],
    ["invalid_visitor_passcode", HttpStatus.BAD_REQUEST],
    ["passcode_verification_required", HttpStatus.CONFLICT],
  ])("returns the public Guard mobile problem for %s", async (code, status) => {
    const module = await loadFilter();
    expect(module).not.toBeNull();
    if (!module) return;

    const result = captureProblem(
      module.MobileProblemFilter,
      new HttpException({ error: code }, status),
    );

    expect(result).toEqual({
      status,
      body: {
        code,
        message: expect.any(String),
        requestId: "request-mobile-123",
      },
    });
  });

  it("redacts unknown internal errors", async () => {
    const module = await loadFilter();
    expect(module).not.toBeNull();
    if (!module) return;

    const secret = "postgresql://admin:password@example.test/remanage?otp=123456";
    const result = captureProblem(module.MobileProblemFilter, new Error(secret));

    expect(result).toEqual({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: "internal_error",
        message: "Something went wrong. Please try again.",
        requestId: "request-mobile-123",
      },
    });
    expect(JSON.stringify(result.body)).not.toContain(secret);
  });
});
