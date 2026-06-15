import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiJson } from "./client.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("apiJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes object bodies and defaults to JSON headers", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ notice: { id: "notice-1" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiJson<{ notice: { id: string } }>("/api/notices", {
      method: "POST",
      body: { title: "Water cut" },
    });

    expect(result.notice.id).toBe("notice-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notices",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Water cut" }),
      }),
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers;
    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get("Content-Type")).toBe("application/json");
    expect((headers as Headers).get("Accept")).toBe("application/json");
  });

  it("throws a typed error with the server message when the API rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "Title and body are required" }, { status: 400 })),
    );

    await expect(apiJson("/api/notices", { method: "POST", body: {} })).rejects.toMatchObject({
      name: "ApiClientError",
      message: "Title and body are required",
      status: 400,
      data: { error: "Title and body are required" },
    });
  });

  it("returns undefined for empty success responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    await expect(apiJson<void>("/api/notices/notice-1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("exposes an instanceof-friendly API error type", () => {
    const error = new ApiClientError("Failed", 500, { error: "Failed" });

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.status).toBe(500);
    expect(error.data).toEqual({ error: "Failed" });
  });
});
