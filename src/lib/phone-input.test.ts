import { describe, expect, it } from "vitest";
import { isOptionalTenDigitPhone, isTenDigitPhone, sanitizePhoneInput } from "./phone-input";

describe("phone input helpers", () => {
  it("keeps only digits and caps input at 10 numbers", () => {
    expect(sanitizePhoneInput("+91 98765-43210 ext 9")).toBe("9198765432");
    expect(sanitizePhoneInput("abc98765xyz43210")).toBe("9876543210");
  });

  it("accepts exactly 10 digits for required phone fields", () => {
    expect(isTenDigitPhone("9876543210")).toBe(true);
    expect(isTenDigitPhone("987654321")).toBe(false);
    expect(isTenDigitPhone("98765432101")).toBe(false);
    expect(isTenDigitPhone("98765abc10")).toBe(false);
  });

  it("allows blank optional phone fields but validates filled values", () => {
    expect(isOptionalTenDigitPhone("")).toBe(true);
    expect(isOptionalTenDigitPhone("9876543210")).toBe(true);
    expect(isOptionalTenDigitPhone("987654321")).toBe(false);
  });
});
