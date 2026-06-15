import { describe, expect, it } from "vitest";
import { PackageRepository, type PackagePersistenceClient } from "./package.repository.ts";

interface RepositoryOperation {
  action: string;
  input: unknown;
}

type PackageTestClient = PackagePersistenceClient & { operations: RepositoryOperation[] };

function createClient(
  options: { existing?: boolean; status?: string; pickupOtp?: string | null } = {},
) {
  const operations: RepositoryOperation[] = [];
  const status = options.status ?? "received";
  const pickupOtp = options.pickupOtp ?? "123456";
  const client: PackageTestClient = {
    operations,
    package: {
      findFirst: async () =>
        options.existing
          ? { id: "package_existing", societyId: "society_a", flatId: "flat_1", status, pickupOtp }
          : null,
      findUnique: async () => ({ id: "package_1", societyId: "society_a", flatId: "flat_1", status, pickupOtp }),
      create: async (input: unknown) => {
        operations.push({ action: "create", input });
        return { id: "package_1", societyId: "society_a", flatId: "flat_1", status: "received", pickupOtp };
      },
      update: async (input: unknown) => {
        operations.push({ action: "update", input });
        const data = (input as { data: { status: string } }).data;
        return { id: "package_1", societyId: "society_a", flatId: "flat_1", status: data.status, pickupOtp };
      },
      findMany: async () => [
        { id: "package_1", societyId: "society_a", flatId: "flat_1", status, pickupOtp },
      ],
    },
  };

  return client;
}

describe("PackageRepository", () => {
  it("creates a package intake with a 6-digit pickup OTP", async () => {
    const client = createClient();
    const repository = new PackageRepository(client, () => "654321");

    const result = await repository.intakePackage({
      societyId: "society_a",
      flatId: "flat_1",
      courierName: "Amazon",
      loggedBy: "guard_1",
      receivedAt: new Date("2026-06-07T11:00:00.000Z"),
    });

    expect(result).toMatchObject({ logged: true, replayed: false, packageId: "package_1", pickupOtp: "654321" });
    expect(client.operations.map((operation) => operation.action)).toEqual(["create"]);
  });

  it("replays a duplicate intake without creating a duplicate", async () => {
    const client = createClient({ existing: true });
    const repository = new PackageRepository(client);

    const result = await repository.intakePackage({
      societyId: "society_a",
      flatId: "flat_1",
      courierName: "Amazon",
      loggedBy: "guard_1",
      receivedAt: new Date("2026-06-07T11:00:00.000Z"),
    });

    expect(result).toMatchObject({ replayed: true, packageId: "package_existing" });
    expect(client.operations).toEqual([]);
  });

  it("notifies a received package", async () => {
    const client = createClient({ status: "received" });
    const repository = new PackageRepository(client);

    await expect(
      repository.notifyPackage({
        societyId: "society_a",
        packageId: "package_1",
        notifiedAt: new Date("2026-06-07T11:05:00.000Z"),
      }),
    ).resolves.toEqual({ packageId: "package_1", status: "notified" });
  });

  it("collects a package only with the correct OTP", async () => {
    const client = createClient({ status: "notified", pickupOtp: "123456" });
    const repository = new PackageRepository(client);

    await expect(
      repository.collectPackage({
        societyId: "society_a",
        packageId: "package_1",
        providedOtp: "123456",
        collectedBy: "Resident A",
        collectedAt: new Date("2026-06-07T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ packageId: "package_1", status: "collected" });
  });

  it("rejects collection with the wrong OTP", async () => {
    const client = createClient({ status: "notified", pickupOtp: "123456" });
    const repository = new PackageRepository(client);

    await expect(
      repository.collectPackage({
        societyId: "society_a",
        packageId: "package_1",
        providedOtp: "000000",
        collectedBy: "Imposter",
        collectedAt: new Date(),
      }),
    ).rejects.toThrow(/otp/i);
  });

  it("rejects acting on a package in another society", async () => {
    const client = createClient();
    const repository = new PackageRepository(client);

    await expect(
      repository.notifyPackage({ societyId: "society_b", packageId: "package_1", notifiedAt: new Date() }),
    ).rejects.toThrow(/society/i);
  });
});
