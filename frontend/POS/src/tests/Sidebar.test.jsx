import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Sidebar from "../components/Sidebar";

describe("Sidebar", () => {
  it("renders all navigation buttons", () => {
    render(<Sidebar />);

    expect(screen.getByText("POS")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Reports")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders exactly 5 navigation buttons", () => {
    render(<Sidebar />);

    const buttons = screen.getAllByRole("button");

    expect(buttons).toHaveLength(5);
  });
});