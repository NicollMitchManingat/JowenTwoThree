import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ProductPage from "../components/ProductPage";

describe("ProductPage", () => {
  it("should render the page title", () => {
    render(<ProductPage />);

    expect(
      screen.getByRole("heading", { name: "Products" })
    ).toBeInTheDocument();
  });

  it("should display a list of products", () => {
    render(<ProductPage />);

    const products = screen.getAllByTestId("product-card");

    expect(products).toHaveLength(3);
  });

  it("should display product names", () => {
    render(<ProductPage />);

    expect(screen.getByText("Burger")).toBeInTheDocument();
    expect(screen.getByText("Pizza")).toBeInTheDocument();
    expect(screen.getByText("Fries")).toBeInTheDocument();
  });

  it("should display product prices", () => {
    render(<ProductPage />);

    expect(screen.getByText("₱120")).toBeInTheDocument();
    expect(screen.getByText("₱250")).toBeInTheDocument();
    expect(screen.getByText("₱80")).toBeInTheDocument();
  });

  it("should display product images", () => {
    render(<ProductPage />);

    expect(screen.getByAltText("Burger")).toBeInTheDocument();
    expect(screen.getByAltText("Pizza")).toBeInTheDocument();
    expect(screen.getByAltText("Fries")).toBeInTheDocument();
  });
});