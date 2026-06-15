"use client";

export type QueuePriority = "high" | "normal" | "low";

export interface CachedApiResponse<T = unknown> {
  key: string;
  url: string;
  data: T;
  etag?: string | null;
  cachedAt: number;
  expiresAt: number;
}

export interface OfflineQueueItem {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  priority: QueuePriority;
  dedupeKey: string;
  attempts: number;
  nextRetryAt: number;
  createdAt: number;
  lastError?: string;
}

export interface MobileDiagnostic {
  id: string;
  type: "api" | "sync" | "offline" | "startup" | "push";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

const DB_NAME = "society-mobile-runtime";
const DB_VERSION = 1;
const STORES = {
  apiCache: "apiCache",
  queue: "queue",
  diagnostics: "diagnostics",
  settings: "settings",
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function ensureBrowser() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb() {
  if (!ensureBrowser()) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.apiCache)) {
        db.createObjectStore(STORES.apiCache, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.queue)) {
        const queue = db.createObjectStore(STORES.queue, { keyPath: "id" });
        queue.createIndex("nextRetryAt", "nextRetryAt");
        queue.createIndex("dedupeKey", "dedupeKey", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.diagnostics)) {
        const diagnostics = db.createObjectStore(STORES.diagnostics, { keyPath: "id" });
        diagnostics.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = run(store);
    let result: T;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getCachedApi<T>(key: string) {
  try {
    return await withStore<CachedApiResponse<T> | undefined>(STORES.apiCache, "readonly", (store) => store.get(key));
  } catch {
    return undefined;
  }
}

export async function setCachedApi<T>(entry: CachedApiResponse<T>) {
  try {
    await withStore<void>(STORES.apiCache, "readwrite", (store) => {
      store.put(entry);
    });
  } catch {
    // Cache failures should never break user flows.
  }
}

export async function enqueueOfflineRequest(item: Omit<OfflineQueueItem, "id" | "attempts" | "nextRetryAt" | "createdAt">) {
  const now = Date.now();
  const id = `${item.method}:${item.dedupeKey}:${now}`;
  const queued: OfflineQueueItem = {
    ...item,
    id,
    attempts: 0,
    nextRetryAt: now,
    createdAt: now,
  };

  await withStore<void>(STORES.queue, "readwrite", (store) => {
    store.put(queued);
  });

  window.dispatchEvent(new CustomEvent("mobile-queue-change"));
  return queued;
}

export async function getQueuedRequests() {
  try {
    return (await withStore<OfflineQueueItem[]>(STORES.queue, "readonly", (store) => store.getAll())) || [];
  } catch {
    return [];
  }
}

export async function updateQueuedRequest(item: OfflineQueueItem) {
  await withStore<void>(STORES.queue, "readwrite", (store) => {
    store.put(item);
  });
  window.dispatchEvent(new CustomEvent("mobile-queue-change"));
}

export async function removeQueuedRequest(id: string) {
  await withStore<void>(STORES.queue, "readwrite", (store) => {
    store.delete(id);
  });
  window.dispatchEvent(new CustomEvent("mobile-queue-change"));
}

export async function getQueueCount() {
  try {
    const items = await getQueuedRequests();
    return items.length;
  } catch {
    return 0;
  }
}

export async function setMobileSetting<T>(key: string, value: T) {
  try {
    await withStore<void>(STORES.settings, "readwrite", (store) => {
      store.put({ key, value, updatedAt: Date.now() });
    });
  } catch {
    localStorage.setItem(`mobile:${key}`, JSON.stringify(value));
  }
}

export async function getMobileSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await withStore<{ value: T } | undefined>(STORES.settings, "readonly", (store) => store.get(key));
    return row?.value ?? fallback;
  } catch {
    const raw = localStorage.getItem(`mobile:${key}`);
    return raw ? JSON.parse(raw) as T : fallback;
  }
}

export async function logMobileDiagnostic(event: Omit<MobileDiagnostic, "id" | "createdAt">) {
  const diagnostic: MobileDiagnostic = {
    ...event,
    id: `${event.type}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  };

  try {
    await withStore<void>(STORES.diagnostics, "readwrite", (store) => {
      store.put(diagnostic);
    });
  } catch {
    // Diagnostics are best-effort only.
  }
}
