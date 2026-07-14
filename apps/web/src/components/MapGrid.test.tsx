import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MapLocation } from "@statecraft/shared";
import { MapGrid } from "./MapGrid";

const locations: MapLocation[] = [
  {
    id: "capital",
    nationId: "nation",
    name: "New Atlas",
    type: "CAPITAL",
    x: 2,
    y: 3,
    developmentLevel: 2,
    population: 100000,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  },
  {
    id: "mine",
    nationId: "nation",
    name: "North Mine",
    type: "MINE",
    x: 6,
    y: 7,
    developmentLevel: 1,
    resourceType: "IRON",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01"
  }
];

describe("MapGrid", () => {
  it("keeps empty tiles noninteractive and selects populated semantic buttons", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<MapGrid locations={locations} layer="RESOURCES" onSelect={onSelect} />);

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("grid", { name: /Resources layer/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "North Mine, Mine" }));
    expect(onSelect).toHaveBeenCalledWith(locations[1]);
  });
});
