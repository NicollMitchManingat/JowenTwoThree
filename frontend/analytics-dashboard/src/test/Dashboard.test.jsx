import { render, screen, fireEvent } from "@testing-library/react";
import Dashboard from "../components/Dashboard";
import { renderWithProvider } from "../test/test-utils";

describe("Dashboard", () => {
  test("renders dashboard title", () => {
    renderWithProvider(<Dashboard />);

    expect(
      screen.getByText(/Jowens Kitchen and Cafe Analytics Dashboard/i)
    ).toBeInTheDocument();
  });

  test("changes tab when clicked", () => {
    renderWithProvider(<Dashboard />);

    fireEvent.click(screen.getByText("Inventory"));

    expect(screen.getByText("Inventory Analytics")).toBeInTheDocument();
  });

  test("updates date filter", () => {
    renderWithProvider(<Dashboard />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "This Week" },
    });

    expect(screen.getByText(/Date Filter: This Week/i)).toBeInTheDocument();
  });
});