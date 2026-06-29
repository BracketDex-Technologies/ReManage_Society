import { describe, expect, it } from "vitest";
import {
  buildCustomInvoiceSelectionGroups,
  toggleAllAvailableFlatIds,
  toggleFlatGroupSelection,
} from "./custom-invoice-selection";

const flats = [
  { id: "flat-a-101", flatNumber: "A-101", wing: "A" },
  { id: "flat-a-102", flatNumber: "A-102", wing: "A" },
  { id: "flat-b-201", flatNumber: "B-201", wing: "B" },
  { id: "flat-no-wing", flatNumber: "Shop-1", wing: null },
];

describe("custom invoice selection", () => {
  it("toggles all available flats between selected and deselected", () => {
    expect(toggleAllAvailableFlatIds([], flats)).toEqual(flats.map((flat) => flat.id));
    expect(toggleAllAvailableFlatIds(["flat-a-101", "flat-a-102", "flat-b-201", "flat-no-wing"], flats)).toEqual([]);
  });

  it("builds wingwise and flatwise option groups", () => {
    expect(buildCustomInvoiceSelectionGroups(flats)).toEqual({
      wingOptions: [
        { label: "Wing A", value: "A", flatIds: ["flat-a-101", "flat-a-102"] },
        { label: "Wing B", value: "B", flatIds: ["flat-b-201"] },
        { label: "No wing", value: "__NO_WING__", flatIds: ["flat-no-wing"] },
      ],
      flatOptions: [
        { label: "A-101", value: "flat-a-101" },
        { label: "A-102", value: "flat-a-102" },
        { label: "B-201", value: "flat-b-201" },
        { label: "Shop-1", value: "flat-no-wing" },
      ],
    });
  });

  it("toggles wing or flat groups without losing existing selections", () => {
    expect(toggleFlatGroupSelection(["flat-b-201"], ["flat-a-101", "flat-a-102"])).toEqual([
      "flat-b-201",
      "flat-a-101",
      "flat-a-102",
    ]);
    expect(toggleFlatGroupSelection(["flat-a-101", "flat-a-102", "flat-b-201"], ["flat-a-101", "flat-a-102"])).toEqual([
      "flat-b-201",
    ]);
    expect(toggleFlatGroupSelection(["flat-b-201"], ["flat-b-201"])).toEqual([]);
  });
});
