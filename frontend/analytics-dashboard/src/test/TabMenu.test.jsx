import { render, screen, fireEvent } from "@testing-library/react";
import TabMenu from "../components/TabMenu";
import { vi } from "vitest";

describe("TabMenu", () => {
  test("renders all tabs", () => {
    render(<TabMenu activeTab="Sales" setActiveTab={() => {}} />);

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
  });

  test("calls setActiveTab when Sales is clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="Inventory" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Sales"));

    expect(mockFn).toHaveBeenCalledWith("Sales");
  });

  test("calls setActiveTab when Inventory is clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="Sales" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Inventory"));

    expect(mockFn).toHaveBeenCalledWith("Inventory");
  });

  test("calls setActiveTab when Customers is clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="Sales" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Customers"));

    expect(mockFn).toHaveBeenCalledWith("Customers");
  });
});