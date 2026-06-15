import { describe, expect, it, vi } from "vitest";
import { SocietyApiClient, SocietyApiError } from "./client.ts";

describe("SocietyApiClient", () => {
  it("sends bearer token, society id, and idempotency key", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ok: true }, { status: 200 }),
    );

    const client = new SocietyApiClient({
      baseUrl: "http://localhost:4000",
      societyId: "soc_123",
      getAccessToken: () => "token-abc",
      fetchImpl,
    });

    await client.request("/api/v1/finance-core/invoices/create", {
      method: "POST",
      body: { amount: 100 },
      idempotencyKey: "idem-1",
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/finance-core/invoices/create");
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer token-abc");
    expect(headers.get("x-society-id")).toBe("soc_123");
    expect(headers.get("idempotency-key")).toBe("idem-1");
  });

  it("throws SocietyApiError for non-2xx responses", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: "forbidden" }, { status: 403 }),
    );

    const client = new SocietyApiClient({
      baseUrl: "http://localhost:4000",
      fetchImpl,
    });

    await expect(client.request("/api/v1/community/notices/list")).rejects.toBeInstanceOf(
      SocietyApiError,
    );
  });
});
