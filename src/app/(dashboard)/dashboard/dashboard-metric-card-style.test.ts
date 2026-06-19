import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardPage = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"), "utf8");

describe("chairman metric-card color treatment", () => {
  it("uses stronger tinted card backgrounds without changing the approved borders", () => {
    expect(dashboardPage).toContain('border-[#FDBA74] bg-[#FFEEE0] hover:border-[#F97316]');
    expect(dashboardPage).toContain('border-[#4ADE80] bg-[#DCFCE7] hover:border-[#16A34A]');
    expect(dashboardPage).toContain('border-[#60A5FA] bg-[#DBEAFE] hover:border-[#2563EB]');
    expect(dashboardPage).toContain('border-[#C084FC] bg-[#F3E8FF] hover:border-[#9333EA]');
  });
});
