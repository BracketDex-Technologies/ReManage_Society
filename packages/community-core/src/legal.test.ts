import { describe, expect, it } from "vitest";
import {
  LEGAL_CHECKLIST_DISCLAIMER,
  instantiateLegalChecklist,
  listLegalChecklistTemplates,
} from "./index.ts";

describe("legal checklist templates", () => {
  it("lists templates with a non-advisory disclaimer", () => {
    const { disclaimer, templates } = listLegalChecklistTemplates();
    expect(disclaimer).toBe(LEGAL_CHECKLIST_DISCLAIMER);
    expect(disclaimer.toLowerCase()).toContain("not legal advice");
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(templates[0]).toHaveProperty("items");
  });

  it("instantiates a checklist with unchecked items and a disclaimer", () => {
    const checklist = instantiateLegalChecklist("agm-conduct");
    expect(checklist.templateId).toBe("agm-conduct");
    expect(checklist.disclaimer.toLowerCase()).toContain("not legal advice");
    expect(checklist.items.every((item) => item.done === false)).toBe(true);
  });

  it("rejects unknown templates", () => {
    expect(() => instantiateLegalChecklist("does-not-exist")).toThrow(/not found/);
  });
});
