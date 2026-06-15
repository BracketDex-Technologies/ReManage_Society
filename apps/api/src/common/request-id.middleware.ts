import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

interface RequestWithHeaders {
  headers: IncomingMessage["headers"];
}

interface ResponseWithHeader {
  header?: (name: string, value: string) => void;
  setHeader?: (name: string, value: string) => void;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithHeaders, response: ResponseWithHeader | ServerResponse, next: () => void): void {
    const headerValue = request.headers["x-request-id"];
    const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const resolvedRequestId = requestId || randomUUID();
    const writableResponse = response as ResponseWithHeader;

    if (typeof writableResponse.header === "function") {
      writableResponse.header("x-request-id", resolvedRequestId);
    } else if (typeof writableResponse.setHeader === "function") {
      writableResponse.setHeader("x-request-id", resolvedRequestId);
    }

    next();
  }
}
