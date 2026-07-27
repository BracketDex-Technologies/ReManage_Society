import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { ServerResponse } from "node:http";

export interface MobileProblemBody {
  code: string;
  message: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
}

interface RequestLike {
  url?: string;
}

interface ResponseLike {
  code?: (status: number) => ResponseLike;
  end?: (body: string) => void;
  getHeader?: (name: string) => number | string | string[] | undefined;
  send?: (body: MobileProblemBody) => void;
  setHeader?: (name: string, value: string) => void;
  status?: (status: number) => ResponseLike;
  statusCode?: number;
  type?: (contentType: string) => ResponseLike;
}

const INTERNAL_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const MOBILE_GUARD_PUBLIC_PROBLEM_CODES = [
  "flat_not_found",
  "visitor_not_found",
  "visitor_not_approved",
  "visitor_not_inside",
  "visitor_blacklisted",
  "invalid_visitor_passcode",
  "passcode_verification_required",
] as const;

const KNOWN_CODES = new Set([
  "invalid_credentials",
  "invalid_mobile_session",
  "invalid_or_expired_otp",
  "mobile_api_disabled",
  "rate_limit_exceeded",
  ...MOBILE_GUARD_PUBLIC_PROBLEM_CODES,
]);

@Catch()
export class MobileProblemFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<ResponseLike | ServerResponse>();
    const request = context.getRequest<RequestLike>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.problem(exception, status, this.header(response, "x-request-id"));

    this.send(response, status, body);
  }

  private problem(exception: unknown, status: number, requestId?: string): MobileProblemBody {
    const error = this.domainError(exception);
    const fieldErrors = status === HttpStatus.BAD_REQUEST
      ? this.fieldErrors(exception)
      : undefined;

    if (fieldErrors) {
      return withRequestId({
        code: "validation_error",
        message: "Please correct the highlighted fields.",
        fieldErrors,
      }, requestId);
    }

    if (error && KNOWN_CODES.has(error)) {
      return withRequestId({ code: error, message: publicMessage(error) }, requestId);
    }

    if (status === HttpStatus.FORBIDDEN) {
      return withRequestId({ code: "forbidden", message: "You do not have permission to perform this action." }, requestId);
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return withRequestId({ code: "unauthorized", message: "Authentication is required." }, requestId);
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return withRequestId({ code: "rate_limit_exceeded", message: publicMessage("rate_limit_exceeded") }, requestId);
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return withRequestId({ code: "internal_error", message: INTERNAL_ERROR_MESSAGE }, requestId);
    }

    return withRequestId({ code: "request_failed", message: "The request could not be completed." }, requestId);
  }

  private domainError(exception: unknown): string | undefined {
    if (!(exception instanceof HttpException)) return undefined;
    const response = exception.getResponse();
    if (typeof response !== "object" || response === null || !("error" in response)) return undefined;
    const error = (response as { error?: unknown }).error;
    return typeof error === "string" ? error : undefined;
  }

  private fieldErrors(exception: unknown): Record<string, string[]> | undefined {
    if (!(exception instanceof HttpException)) return undefined;
    const response = exception.getResponse();
    if (typeof response !== "object" || response === null || !("message" in response)) return undefined;
    const messages = (response as { message?: unknown }).message;
    if (!Array.isArray(messages) || !messages.every((message) => typeof message === "string")) return undefined;

    const fieldErrors: Record<string, string[]> = {};
    for (const message of messages) {
      const match = /^([^\s]+)\s+(.+)$/.exec(message);
      if (!match) continue;
      const [, field, detail] = match;
      (fieldErrors[field] ??= []).push(detail);
    }
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
  }

  private send(response: ResponseLike | ServerResponse, status: number, body: MobileProblemBody): void {
    const reply = response as ResponseLike;
    if (typeof reply.status === "function") {
      reply.status(status).type?.("application/json").send?.(body);
      return;
    }
    if (typeof reply.code === "function") {
      reply.code(status).type?.("application/json").send?.(body);
      return;
    }
    response.statusCode = status;
    response.setHeader?.("content-type", "application/json");
    response.end?.(JSON.stringify(body));
  }

  private header(response: ResponseLike | ServerResponse, name: string): string | undefined {
    if (typeof response.getHeader !== "function") return undefined;
    const value = response.getHeader(name);
    return Array.isArray(value) ? value.join(",") : value?.toString();
  }
}

function withRequestId(body: MobileProblemBody, requestId?: string): MobileProblemBody {
  return requestId ? { ...body, requestId } : body;
}

function publicMessage(code: string): string {
  switch (code) {
    case "invalid_credentials":
    case "invalid_or_expired_otp":
      return "The credentials provided are not valid.";
    case "invalid_mobile_session":
      return "Your session is no longer valid. Please sign in again.";
    case "mobile_api_disabled":
      return "Mobile access is not available for this society.";
    case "rate_limit_exceeded":
      return "Too many attempts. Please try again later.";
    case "flat_not_found":
      return "The requested flat was not found.";
    case "visitor_not_found":
      return "The visitor was not found.";
    case "visitor_not_approved":
      return "Visitor approval is required before check-in.";
    case "visitor_not_inside":
      return "The visitor has not checked in.";
    case "visitor_blacklisted":
      return "This visitor cannot be admitted.";
    case "invalid_visitor_passcode":
      return "The visitor passcode is not valid.";
    case "passcode_verification_required":
      return "Verify the visitor passcode before check-in.";
    default:
      return "The request could not be completed.";
  }
}
