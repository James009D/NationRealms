import { describe, expect, it } from "vitest";
import { EVENT_TEMPLATES } from "./eventTemplates.js";
import { validateEventTemplateLibrary } from "./eventTemplateValidation.js";

describe("event template library", () => {
  it("contains only unique, structurally valid, connected templates", () => {
    expect(validateEventTemplateLibrary(EVENT_TEMPLATES)).toHaveLength(EVENT_TEMPLATES.length);
  });
});
