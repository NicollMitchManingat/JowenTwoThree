import { render, screen, fireEvent } from "@testing-library/react";
import TabMenu from "../components/analytics/TabMenu";
import { vi } from "vitest";

describe("TabMenu", () => {
  test("renders all tabs", () => {
    render(<TabMenu activeTab="sales" setActiveTab={() => {}} />);

    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("Customer Traffic")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("AI Insights")).toBeInTheDocument();
    expect(screen.getByText("Reports & Sessions")).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByRole('tab', { name: 'Sales' })).toHaveAttribute('aria-selected', 'true');
  });

  test("calls setActiveTab when Sales is clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="inventory" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Sales"));

    expect(mockFn).toHaveBeenCalledWith("sales");
  });

  test("calls setActiveTab when Inventory is clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="sales" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Inventory"));

    expect(mockFn).toHaveBeenCalledWith("inventory");
  });

  test("calls setActiveTab when Customer Traffic is clicked", () => {
    const mockFn = vi.fn();

    render(<TabMenu activeTab="sales" setActiveTab={mockFn} />);

    fireEvent.click(screen.getByText("Customer Traffic"));

    expect(mockFn).toHaveBeenCalledWith("traffic");
  });

  test('supports arrow keys, Home and End with focus movement and wrapping', () => {
    const change = vi.fn();
    render(<TabMenu activeTab="overview" setActiveTab={change} />);
    const overview = screen.getByRole('tab', { name: 'Overview' });
    expect(overview).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(change).toHaveBeenLastCalledWith('reports');
    expect(screen.getByRole('tab', { name: 'Reports & Sessions' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' });
    expect(overview).toHaveFocus();
    fireEvent.keyDown(overview, { key: 'End' });
    expect(change).toHaveBeenLastCalledWith('reports');
    fireEvent.keyDown(document.activeElement, { key: 'Home' });
    expect(change).toHaveBeenLastCalledWith('overview');
    expect(overview).toHaveFocus();
  });
});
