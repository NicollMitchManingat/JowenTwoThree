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
      screen.getByText("Products")
    ).toBeInTheDocument();
  });

  it("renders the Order Summary section", () => {
    render(<POSLayout />);

    expect(
      screen.getByText("Order Summary")
    ).toBeInTheDocument();
  });
});