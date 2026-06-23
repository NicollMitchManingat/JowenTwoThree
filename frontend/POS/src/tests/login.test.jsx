import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Login from "../components/Login";

describe("Login Component (Role-Based)", () => {
  it("renders login form correctly", () => {
    render(<Login />);

    expect(
      screen.getByRole("heading", { name: "Login" })
    ).toBeInTheDocument();

    expect(screen.getByTestId("username-input")).toBeInTheDocument();
    expect(screen.getByTestId("password-input")).toBeInTheDocument();
    expect(screen.getByTestId("role-select")).toBeInTheDocument();
    expect(screen.getByTestId("login-button")).toBeInTheDocument();
  });

  it("updates input values correctly", () => {
    render(<Login />);

    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "adminUser" },
    });

    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "123456" },
    });

    expect(screen.getByTestId("username-input")).toHaveValue("adminUser");
    expect(screen.getByTestId("password-input")).toHaveValue("123456");
  });

  it("changes role selection", () => {
    render(<Login />);

    fireEvent.change(screen.getByTestId("role-select"), {
      target: { value: "admin" },
    });

    expect(screen.getByTestId("role-select")).toHaveValue("admin");
  });

  it("calls onLogin with correct credentials", () => {
    const mockLogin = vi.fn();

    render(<Login onLogin={mockLogin} />);

    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "cashier1" },
    });

    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "pass123" },
    });

    fireEvent.change(screen.getByTestId("role-select"), {
      target: { value: "cashier" },
    });

    fireEvent.click(screen.getByTestId("login-button"));

    expect(mockLogin).toHaveBeenCalledWith({
      username: "cashier1",
      password: "pass123",
      role: "cashier",
    });
  });
});