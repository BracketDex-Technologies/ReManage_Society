export interface SocietyApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
  societyId?: string;
  fetchImpl?: typeof fetch;
}

export interface SocietyApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  idempotencyKey?: string;
}

export class SocietyApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly payload: unknown,
  ) {
    super(`Society API ${status} on ${path}`);
    this.name = "SocietyApiError";
  }
}

export class SocietyApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: SocietyApiClientOptions["getAccessToken"];
  private readonly societyId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SocietyApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
    this.societyId = options.societyId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(path: string, options: SocietyApiRequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = new Headers(options.headers);

    if (!headers.has("content-type") && options.body !== undefined) {
      headers.set("content-type", "application/json");
    }

    const token = this.getAccessToken ? await this.getAccessToken() : null;
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    if (this.societyId) {
      headers.set("x-society-id", this.societyId);
    }

    if (options.idempotencyKey) {
      headers.set("idempotency-key", options.idempotencyKey);
    }

    const response = await this.fetchImpl(url, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new SocietyApiError(response.status, path, payload);
    }

    return payload as T;
  }
}
