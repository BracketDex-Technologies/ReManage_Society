import { Socket } from "node:net";
import { InMemoryRateLimitStore, type RateLimitStore } from "./rate-limit-core.ts";

export interface ValkeyCommandTransport {
  send(...command: readonly (string | number)[]): Promise<string | number>;
}

export class ValkeyRateLimitStore implements RateLimitStore {
  constructor(private readonly transport: ValkeyCommandTransport) {}

  async increment(key: string, windowMs: number): Promise<number> {
    const count = Number(await this.transport.send("INCR", key));

    if (count === 1) {
      await this.transport.send("PEXPIRE", key, windowMs);
    }

    return count;
  }
}

export class RespValkeyTransport implements ValkeyCommandTransport {
  constructor(
    private readonly options: {
      host: string;
      port: number;
      timeoutMs?: number;
    },
  ) {}

  async send(...command: readonly (string | number)[]): Promise<string | number> {
    const response = await this.roundTrip(encodeRespCommand(command));
    return decodeRespScalar(response);
  }

  private roundTrip(payload: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error("Valkey command timed out"));
      }, this.options.timeoutMs ?? 2_000);

      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      socket.on("data", (chunk) => {
        chunks.push(chunk);
        clearTimeout(timeout);
        socket.end();
        resolve(Buffer.concat(chunks).toString("utf8"));
      });

      socket.connect(this.options.port, this.options.host, () => {
        socket.write(payload);
      });
    });
  }
}

export function parseValkeyUrl(url = process.env.VALKEY_URL): { host: string; port: number } | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
    };
  } catch {
    return null;
  }
}

let sharedStore: RateLimitStore | undefined;

export function createRateLimitStore(forceInMemory = false): RateLimitStore {
  if (sharedStore && !forceInMemory) {
    return sharedStore;
  }

  const target = parseValkeyUrl();

  const isProd = process.env.NODE_ENV === "production";
  if (!forceInMemory && target && isProd) {
    // Production with Valkey configured – use real store with automatic fallback.
    const valkeyStore = new ValkeyRateLimitStore(new RespValkeyTransport(target));
    // Wrap the store to fall back to in-memory on connection errors.
    sharedStore = {
      async increment(key: string, windowMs: number): Promise<number> {
        try {
          return await valkeyStore.increment(key, windowMs);
        } catch {
          // Valkey unreachable — fall back to in-memory for this process.
          console.warn("[rate-limit] Valkey unreachable, falling back to in-memory store");
          sharedStore = new InMemoryRateLimitStore();
          return sharedStore.increment(key, windowMs);
        }
      },
    };
    return sharedStore;
  }

  // Development, tests, or when Valkey is unavailable — always use in-memory.
  sharedStore = new InMemoryRateLimitStore();
  return sharedStore;
}

export function resetRateLimitStoreForTests(): void {
  sharedStore = undefined;
}

function encodeRespCommand(command: readonly (string | number)[]): string {
  return [
    `*${command.length}`,
    ...command.flatMap((part) => {
      const value = String(part);
      return [`$${Buffer.byteLength(value)}`, value];
    }),
    "",
  ].join("\r\n");
}

function decodeRespScalar(response: string): string | number {
  const type = response[0];
  const value = response.slice(1).split("\r\n")[0] ?? "";

  if (type === ":") {
    return Number(value);
  }

  if (type === "+" || type === "$") {
    return value;
  }

  if (type === "-") {
    throw new Error(value);
  }

  throw new Error(`Unsupported Valkey response: ${response}`);
}
