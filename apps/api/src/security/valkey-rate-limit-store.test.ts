import { describe, expect, it } from "vitest";
import { ValkeyRateLimitStore, type ValkeyCommandTransport } from "./valkey-rate-limit-store.ts";

describe("ValkeyRateLimitStore", () => {
  it("increments a distributed bucket and sets expiry on first hit", async () => {
    const commands: string[][] = [];
    const transport: ValkeyCommandTransport = {
      send: async (...command) => {
        commands.push(command.map(String));
        return command[0] === "INCR" ? 1 : "OK";
      },
    };
    const store = new ValkeyRateLimitStore(transport);

    await expect(store.increment("api:society:user:login", 60_000)).resolves.toBe(1);

    expect(commands).toEqual([
      ["INCR", "api:society:user:login"],
      ["PEXPIRE", "api:society:user:login", "60000"],
    ]);
  });
});
