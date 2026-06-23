import { render, screen, fireEvent } from "@testing-library/react";
import TabMenu from "../components/TabMenu";

describe("TabMenu", () => {
  test("renders all tabs", () => {
    render(<TabMenu activeTab="Sales" setActiveTab={() => {}} />);

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
  });

  test("calls setActiveTab when clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="Sales" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Inventory"));

    expect(mockFn).toHaveBeenCalledWith("Inventory");
  });
});