import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./AuthPage";

const api = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  login: vi.fn(),
  registerAccount: vi.fn()
}));

vi.mock("../api", () => api);

describe("AuthPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("explains unavailable accounts before showing a memory-mode form", async () => {
    api.getAuthSession.mockResolvedValue({ accountsAvailable: false });
    render(
      <MemoryRouter>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    expect(await screen.findByText("Persistent account mode is not enabled on this server.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter Demo Nation" })).toHaveAttribute("href", "/demo");
  });

  it("allows four-character passwords when account mode is available", async () => {
    api.getAuthSession.mockResolvedValue({ accountsAvailable: true });
    render(
      <MemoryRouter>
        <AuthPage mode="register" />
      </MemoryRouter>
    );
    const password = await screen.findByLabelText(/Password/);
    expect(password).toHaveAttribute("minlength", "4");
    expect(screen.getByRole("button", { name: "Register" })).toBeEnabled();
  });
});
