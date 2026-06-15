import { describe, expect, it } from "vitest";
import {
  buildResidentDirectory,
  createSocietySetupPlan,
  planOccupancyMove,
  validateSocietyImportRows,
} from "./index.ts";

describe("createSocietySetupPlan", () => {
  it("normalizes building inventory into active vacant units", () => {
    const plan = createSocietySetupPlan({
      societyId: "society_a",
      societyName: "Palm Heights",
      buildings: [
        {
          name: "Tower A",
          wings: [
            {
              name: "A",
              floors: [
                {
                  number: 1,
                  units: [
                    { unitNumber: "A-101", unitType: "2BHK" },
                    { unitNumber: "A-102", unitType: "3BHK", usageType: "RESIDENTIAL" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(plan.summary).toEqual({
      buildings: 1,
      wings: 1,
      floors: 1,
      units: 2,
    });
    expect(plan.units).toEqual([
      {
        societyId: "society_a",
        buildingName: "Tower A",
        wing: "A",
        floor: 1,
        unitNumber: "A-101",
        unitType: "2BHK",
        usageType: "RESIDENTIAL",
        occupancyStatus: "VACANT",
        billingStatus: "ACTIVE",
      },
      {
        societyId: "society_a",
        buildingName: "Tower A",
        wing: "A",
        floor: 1,
        unitNumber: "A-102",
        unitType: "3BHK",
        usageType: "RESIDENTIAL",
        occupancyStatus: "VACANT",
        billingStatus: "ACTIVE",
      },
    ]);
  });

  it("reports duplicate unit numbers before setup is applied", () => {
    const plan = createSocietySetupPlan({
      societyId: "society_a",
      societyName: "Palm Heights",
      buildings: [
        {
          name: "Tower A",
          wings: [
            {
              name: "A",
              floors: [
                {
                  number: 1,
                  units: [{ unitNumber: "A-101" }, { unitNumber: "A-101" }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(plan.ready).toBe(false);
    expect(plan.errors).toEqual([
      {
        code: "duplicate_unit",
        message: "Unit A-101 appears more than once in society society_a.",
        path: "buildings[0].wings[0].floors[0].units[1].unitNumber",
      },
    ]);
  });
});

describe("validateSocietyImportRows", () => {
  it("returns row-level dry-run errors without accepting invalid rows", () => {
    const result = validateSocietyImportRows([
      {
        rowNumber: 2,
        unitNumber: "A-101",
        personName: "Neha Rao",
        phone: " 9876543210 ",
        relationshipType: "OWNER",
      },
      {
        rowNumber: 3,
        unitNumber: "",
        personName: "Missing Unit",
        relationshipType: "TENANT",
      },
      {
        rowNumber: 4,
        unitNumber: "A-102",
        personName: "",
        relationshipType: "FRIEND",
      },
    ]);

    expect(result.accepted).toEqual([
      {
        rowNumber: 2,
        unitNumber: "A-101",
        personName: "Neha Rao",
        phone: "9876543210",
        relationshipType: "OWNER",
        billingResponsibility: "OWNER",
      },
    ]);
    expect(result.errors).toEqual([
      {
        rowNumber: 3,
        field: "unitNumber",
        code: "required",
        message: "Unit number is required.",
      },
      {
        rowNumber: 4,
        field: "personName",
        code: "required",
        message: "Person name is required.",
      },
      {
        rowNumber: 4,
        field: "relationshipType",
        code: "unsupported_relationship",
        message: "Relationship FRIEND is not supported for Phase 3 import.",
      },
    ]);
  });
});

describe("planOccupancyMove", () => {
  it("creates an auditable move-in plan for a tenant", () => {
    expect(
      planOccupancyMove({
        societyId: "society_a",
        unitId: "unit_101",
        personId: "person_neha",
        relationshipType: "TENANT",
        moveType: "MOVE_IN",
        effectiveDate: new Date("2026-06-07T00:00:00.000Z"),
        actorId: "committee_1",
      }),
    ).toEqual({
      societyId: "society_a",
      unitId: "unit_101",
      personId: "person_neha",
      relationshipType: "TENANT",
      newUnitOccupancyStatus: "TENANT_OCCUPIED",
      occupancyStatus: "ACTIVE",
      billingResponsibility: "TENANT",
      moveEvent: {
        type: "move_in",
        initiatedBy: "committee_1",
        residentType: "tenant",
        status: "initiated",
        effectiveDate: "2026-06-07T00:00:00.000Z",
      },
    });
  });

  it("creates an auditable move-out plan that closes occupancy", () => {
    expect(
      planOccupancyMove({
        societyId: "society_a",
        unitId: "unit_101",
        personId: "person_neha",
        relationshipType: "TENANT",
        moveType: "MOVE_OUT",
        effectiveDate: new Date("2026-06-07T00:00:00.000Z"),
        actorId: "committee_1",
      }),
    ).toMatchObject({
      newUnitOccupancyStatus: "VACANT",
      occupancyStatus: "MOVED_OUT",
      moveEvent: {
        type: "move_out",
        status: "initiated",
      },
    });
  });
});

describe("buildResidentDirectory", () => {
  it("hides resident contact details unless visibility or role allows it", () => {
    const directory = buildResidentDirectory(
      [
        {
          unitNumber: "A-101",
          personName: "Neha Rao",
          relationshipType: "OWNER",
          phone: "9876543210",
          email: "neha@example.com",
          showPhone: false,
          showEmail: false,
        },
        {
          unitNumber: "A-102",
          personName: "Aman Shah",
          relationshipType: "TENANT",
          phone: "9999999999",
          email: "aman@example.com",
          showPhone: true,
          showEmail: false,
        },
      ],
      { role: "resident" },
    );

    expect(directory).toEqual([
      {
        unitNumber: "A-101",
        personName: "Neha Rao",
        relationshipType: "OWNER",
      },
      {
        unitNumber: "A-102",
        personName: "Aman Shah",
        relationshipType: "TENANT",
        phone: "9999999999",
      },
    ]);
  });

  it("shows full directory contact details to committee viewers", () => {
    const directory = buildResidentDirectory(
      [
        {
          unitNumber: "A-101",
          personName: "Neha Rao",
          relationshipType: "OWNER",
          phone: "9876543210",
          email: "neha@example.com",
          showPhone: false,
          showEmail: false,
        },
      ],
      { role: "committee" },
    );

    expect(directory[0]).toEqual({
      unitNumber: "A-101",
      personName: "Neha Rao",
      relationshipType: "OWNER",
      phone: "9876543210",
      email: "neha@example.com",
    });
  });
});
