import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import OrderSummary from "../components/OrderSummary";

describe("OrderSummary", () => {
  it("should render the order summary title", () => {
    render(<OrderSummary />);

    expect(
      screen.getByText("Order Summary")
    ).toBeInTheDocument();
  });
  //
  it("should display cart items", () => {
    render(<OrderSummary />);

    const items = screen.getAllByTestId("cart-item");

    expect(items.length).toBe(2);
  });
// mock data
  it("should display item names", () => {
  const mockItems = [
    { id: 1, name: "Burger" },
    { id: 2, name: "Fries" },
  ];

  render(<OrderSummary items={mockItems} />);

  expect(screen.getByText("Burger")).toBeInTheDocument();
  expect(screen.getByText("Fries")).toBeInTheDocument();
});

  it("should display item quantities", () => {
    render(<OrderSummary />);

    expect(screen.getByText(/x2/i)).toBeInTheDocument();
    expect(screen.getByText(/x1/i)).toBeInTheDocument();
  });

  it("should display the correct total price", () => {
    render(<OrderSummary />);

    expect(
      screen.getByTestId("total-price")
    ).toHaveTextContent("Total: ₱320");
  });
});