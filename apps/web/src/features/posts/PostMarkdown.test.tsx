import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostMarkdown } from "./PostMarkdown";

describe("PostMarkdown", () => {
  it("renders Markdown while refusing raw executable HTML", () => {
    const { container } = render(
      <PostMarkdown body={"# Dispatch\n\n<script>window.hacked = true</script>\n\n**Safe text**"} format="MARKDOWN" />
    );
    expect(screen.getByRole("heading", { name: "Dispatch" })).toBeInTheDocument();
    expect(screen.getByText("Safe text")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
});
