import { describe, expect, it } from "vitest";
import { formatEnum, locationMarker } from "./format";

describe("format helpers", () => {
  it("formats enum values for display", () => {
    expect(formatEnum("MILITARY_BASE")).toBe("Military Base");
    expect(formatEnum("publicTrust")).toBe("Public Trust");
  });

  it("returns stable ASCII map markers", () => {
    expect(locationMarker("CAPITAL")).toBe("*");
    expect(locationMarker("PORT")).toBe("P");
  });
});
