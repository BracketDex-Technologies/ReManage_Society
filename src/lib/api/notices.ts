import { apiJson } from "./client.ts";

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  postedBy: string;
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface NoticeInput {
  title: string;
  body: string;
  category: string;
  isPinned: boolean;
}

export type NoticeUpdateInput = Partial<Pick<Notice, "isPinned">>;

export async function listNotices(): Promise<Notice[]> {
  const data = await apiJson<{ notices?: Notice[] }>("/api/notices");
  return data.notices ?? [];
}

export async function createNotice(input: NoticeInput): Promise<Notice | undefined> {
  const data = await apiJson<{ notice?: Notice }>("/api/notices", {
    method: "POST",
    body: input,
  });
  return data.notice;
}

export async function updateNotice(id: string, input: NoticeUpdateInput): Promise<Notice | undefined> {
  const data = await apiJson<{ notice?: Notice }>(`/api/notices/${id}`, {
    method: "PATCH",
    body: input,
  });
  return data.notice;
}

export async function deleteNotice(id: string): Promise<void> {
  await apiJson<void>(`/api/notices/${id}`, {
    method: "DELETE",
  });
}
