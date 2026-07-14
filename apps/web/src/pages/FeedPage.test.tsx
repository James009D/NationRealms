import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedPage } from "./FeedPage";

const api = vi.hoisted(() => ({
  getFeed: vi.fn(),
  getNationInbox: vi.fn(),
  getNations: vi.fn(),
  createNationConversation: vi.fn(),
  getNationConversation: vi.fn(),
  sendNationMessage: vi.fn(),
  updateNationConversation: vi.fn(),
  respondToDiplomaticOffer: vi.fn()
}));

vi.mock("../api", () => api);
vi.mock("../realtime", () => ({ subscribeToRealtimeEvent: () => vi.fn() }));

describe("FeedPage navigation", () => {
  beforeEach(() => {
    api.getFeed.mockResolvedValue([]);
    api.getNationInbox.mockResolvedValue({ unreadCount: 0, conversations: [] });
  });

  it("keeps the active nation's navigation on the world feed", async () => {
    render(
      <MemoryRouter initialEntries={["/nation/demo-nation/feed"]}>
        <Routes>
          <Route path="/nation/:id/feed" element={<FeedPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "World Dispatches" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/nation/demo-nation");
    expect(screen.getByRole("link", { name: "Feed" })).toHaveAttribute("href", "/nation/demo-nation/feed");
    expect(screen.queryByRole("link", { name: "Create" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Nation" })).not.toBeInTheDocument();
  });

  it("provides basic navigation when opened as a public feed", async () => {
    render(
      <MemoryRouter initialEntries={["/feed"]}>
        <Routes>
          <Route path="/feed" element={<FeedPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "World Dispatches" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Demo Nation" })).toHaveAttribute("href", "/demo");
    expect(screen.queryByRole("link", { name: "Create Nation" })).not.toBeInTheDocument();
  });
});
