import { describe, expect, it } from "vitest";
import { credentialsSchema, registerSchema } from "./auth.js";

describe("account input validation", () => {
  it("accepts simple four-character passwords", () => {
    expect(credentialsSchema.parse({ email: "player@example.test", password: "a1b2" }).password).toBe("a1b2");
    expect(
      registerSchema.parse({ email: "player@example.test", password: "1234", displayName: "Player" }).password
    ).toBe("1234");
  });

  it("rejects passwords shorter than four characters", () => {
    expect(() => credentialsSchema.parse({ email: "player@example.test", password: "a1b" })).toThrow();
  });
});
