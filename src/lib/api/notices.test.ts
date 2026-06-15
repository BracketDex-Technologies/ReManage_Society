import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotice, deleteNotice, listNotices, updateNotice } from "./notices.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

describe("notices API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists notices from the BFF route", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        notices: [
          {
            id: "notice-1",
            title: "Water cut",
            body: "No supply from 10 AM",
            category: "maintenance",
            postedBy: "Secretary",
            isPinned: true,
            expiresAt: null,
            createdAt: "2026-06-07T00:00:00.000Z",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listNotices()).resolves.toEqual([
      expect.objectContaining({ id: "notice-1", title: "Water cut" }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith("/api/notices", expect.any(Object));
  });

  it("creates notices through the BFF route", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ notice: { id: "notice-1" } }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await createNotice({
      title: "AGM",
      body: "Meeting at 7 PM",
      category: "meeting",
      isPinned: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notices",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "AGM",
          body: "Meeting at 7 PM",
          category: "meeting",
          isPinned: false,
        }),
      }),
    );
  });

  it("updates notice pin state through the existing detail route", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ notice: { id: "notice-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateNotice("notice-1", { isPinned: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notices/notice-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ isPinned: true }),
      }),
    );
  });

  it("deletes notices through the existing detail route", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteNotice("notice-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notices/notice-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
