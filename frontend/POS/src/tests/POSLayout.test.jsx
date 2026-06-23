import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import POSLayout from "../components/POSLayout";

describe("POSLayout", () => {
  it("renders the POS dashboard title", () => {
    render(<POSLayout />);

    expect(
      screen.getByText("POS Dashboard")
    ).toBeInTheDocument();
  });

  it("renders the Products section", () => {
    render(<POSLayout />);

    expect(
      screen.getByRole("heading", { name: "Products" })
    ).toBeInTheDocument();
  });

  it("renders the Order Summary section", () => {
    render(<POSLayout />);

    expect(
      screen.getByText("Order Summary")
    ).toBeInTheDocument();
  });

  it("renders ProductPage inside POSLayout", () => {
    render(<POSLayout />);

    expect(screen.getByText("Burger")).toBeInTheDocument();
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("Fries")).toBeInTheDocument();
  });
});