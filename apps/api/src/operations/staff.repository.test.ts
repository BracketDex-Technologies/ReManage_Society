import { describe, expect, it } from "vitest";
import { StaffRepository, type StaffPersistenceClient } from "./staff.repository.ts";

function createClient(
  options: { existingStaff?: boolean; existingAttendance?: boolean } = {},
) {
  const operations: string[] = [];
  const client: StaffPersistenceClient & { log: string[] } = {
    log: operations,
    domesticStaff: {
      findFirst: async () =>
        options.existingStaff ? { id: "staff_existing", societyId: "society_a", entryCode: "111111" } : null,
      findUnique: async () => ({ id: "staff_1", societyId: "society_a", entryCode: "111111" }),
      create: async () => {
        operations.push("staff.create");
        return { id: "staff_1", societyId: "society_a", entryCode: "654321" };
      },
      findMany: async () => [{ id: "staff_1", societyId: "society_a", entryCode: "654321" }],
    },
    staffFlatLink: {
      upsert: async () => {
        operations.push("link.upsert");
        return { id: "link_1" };
      },
    },
    staffAttendance: {
      findFirst: async () =>
        options.existingAttendance
          ? { id: "att_existing", societyId: "society_a", staffId: "staff_1", checkIn: new Date() }
          : null,
      findUnique: async () => ({
        id: "att_1",
        societyId: "society_a",
        staffId: "staff_1",
        checkIn: new Date("2026-06-07T03:00:00.000Z"),
      }),
      create: async () => {
        operations.push("attendance.create");
        return { id: "att_1", societyId: "society_a", staffId: "staff_1", checkIn: new Date() };
      },
      update: async () => {
        operations.push("attendance.update");
        return { id: "att_1", societyId: "society_a", staffId: "staff_1", checkIn: new Date() };
      },
      findMany: async () => [],
    },
  };

  return client;
}

describe("StaffRepository", () => {
  it("registers staff with a normalized category and entry code", async () => {
    const client = createClient();
    const repository = new StaffRepository(client, () => "654321");

    await expect(
      repository.registerStaff({
        societyId: "society_a",
        name: "Sita",
        phone: "9000000000",
        category: "Maid",
      }),
    ).resolves.toEqual({ registered: true, replayed: false, staffId: "staff_1", entryCode: "654321" });
  });

  it("rejects an unsupported staff category", async () => {
    const repository = new StaffRepository(createClient());

    await expect(
      repository.registerStaff({
        societyId: "society_a",
        name: "Sita",
        phone: "9000000000",
        category: "astronaut",
      }),
    ).rejects.toThrow(/not supported/i);
  });

  it("replays a duplicate staff registration", async () => {
    const repository = new StaffRepository(createClient({ existingStaff: true }));

    await expect(
      repository.registerStaff({
        societyId: "society_a",
        name: "Sita",
        phone: "9000000000",
        category: "maid",
      }),
    ).resolves.toMatchObject({ replayed: true, staffId: "staff_existing" });
  });

  it("marks attendance check-in idempotently", async () => {
    const repository = new StaffRepository(createClient());

    await expect(
      repository.markCheckIn({
        societyId: "society_a",
        staffId: "staff_1",
        checkIn: new Date("2026-06-07T03:00:00.000Z"),
        markedBy: "guard_1",
        method: "code",
      }),
    ).resolves.toMatchObject({ recorded: true, replayed: false, attendanceId: "att_1" });
  });

  it("replays a duplicate attendance check-in", async () => {
    const repository = new StaffRepository(createClient({ existingAttendance: true }));

    await expect(
      repository.markCheckIn({
        societyId: "society_a",
        staffId: "staff_1",
        checkIn: new Date("2026-06-07T03:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ replayed: true, attendanceId: "att_existing" });
  });

  it("computes duration on check-out", async () => {
    const repository = new StaffRepository(createClient());

    await expect(
      repository.markCheckOut({
        societyId: "society_a",
        attendanceId: "att_1",
        checkOut: new Date("2026-06-07T05:30:00.000Z"),
      }),
    ).resolves.toEqual({ recorded: true, attendanceId: "att_1", durationMinutes: 150 });
  });
});
