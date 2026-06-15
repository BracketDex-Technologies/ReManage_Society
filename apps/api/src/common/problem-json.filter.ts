import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

interface RequestLike {
  url?: string;
}

interface ResponseLike {
  code?: (status: number) => ResponseLike;
  end?: (body: string) => void;
  getHeader?: (name: string) => number | string | string[] | undefined;
  header?: (name: string, value: string) => ResponseLike;
  send?: (body: ProblemJsonBody) => void;
  setHeader?: (name: string, value: string) => void;
  status?: (status: number) => ResponseLike;
  statusCode?: number;
  type?: (contentType: string) => ResponseLike;
}

interface ProblemJsonBody {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
}

@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<ResponseLike | ServerResponse>();
    const request = context.getRequest<RequestLike | IncomingMessage>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ProblemJsonBody = {
      type: this.problemType(status),
      title: this.title(exception, status),
      status,
      instance: request.url,
      requestId: this.header(response, "x-request-id"),
    };

    const detail = this.detail(exception);
    if (detail) body.detail = detail;

    this.send(response, status, body);
  }

  private send(response: ResponseLike | ServerResponse, status: number, body: ProblemJsonBody): void {
    const reply = response as ResponseLike;

    if (typeof reply.status === "function") {
      reply
        .status(status)
        .type?.("application/problem+json")
        .send?.(body);
      return;
    }

    if (typeof reply.code === "function") {
      reply
        .code(status)
        .type?.("application/problem+json")
        .send?.(body);
      return;
    }

    response.statusCode = status;
    if (typeof response.setHeader === "function") {
      response.setHeader("content-type", "application/problem+json");
    }
    response.end?.(JSON.stringify(body));
  }

  private header(response: ResponseLike | ServerResponse, name: string): string | undefined {
    if (typeof response.getHeader !== "function") return undefined;
    const value = response.getHeader(name);
    if (Array.isArray(value)) return value.join(",");
    return value?.toString();
  }

  private problemType(status: number): string {
    return `https://httpstatuses.com/${status}`;
  }

  private title(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      return exception.name || "HTTP Error";
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal Server Error";
    }

    return "Request Failed";
  }

  private detail(exception: unknown): string | undefined {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === "string") return response;
      if (typeof response === "object" && response !== null && "message" in response) {
        const message = (response as { message: unknown }).message;
        if (Array.isArray(message)) return message.join("; ");
        if (typeof message === "string") return message;
      }
      return exception.message;
    }

    if (exception instanceof Error) return exception.message;
    return undefined;
  }
}
