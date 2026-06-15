export class ApiClientError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.data = data;
  }
}

export interface ApiJsonOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | object | null;
}

function isJsonBody(body: ApiJsonOptions["body"]): body is object {
  return (
    Boolean(body) &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof URLSearchParams)
  );
}

function getErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.error ?? record.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return `Request failed (${status})`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiJson<T>(path: string, options: ApiJsonOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", headers.get("Accept") ?? "application/json");

  let body = options.body as BodyInit | null | undefined;
  if (isJsonBody(options.body)) {
    headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
  });
  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiClientError(getErrorMessage(data, response.status), response.status, data);
  }

  return data as T;
}
