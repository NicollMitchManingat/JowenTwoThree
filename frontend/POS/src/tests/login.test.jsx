import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Login from "../components/Login";

describe("Login Component (Role-Based)", () => {
  it("renders login form correctly", () => {
  });

  it("updates input values correctly", () => {
  });

  it("changes role selection", () => {
  });

  it("calls onLogin with correct credentials", () => {
  });

  it("shows error when fields are empty", () => {
    render(<Login />);

    fireEvent.click(screen.getByTestId("login-button"));

    expect(
      screen.getByTestId("error-message")
    ).toHaveTextContent("Username and password are required.");
  });

  it("shows error for invalid credentials", () => {
    render(<Login />);

    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "wrongUser" },
    });

    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "wrongPass" },
    });

    fireEvent.click(screen.getByTestId("login-button"));

    expect(
      screen.getByTestId("error-message")
    ).toHaveTextContent("Invalid username or password.");
  });

  it("calls onLogin when credentials are valid", () => {
    const mockLogin = vi.fn();

    render(<Login onLogin={mockLogin} />);

    fireEvent.change(screen.getByTestId("username-input"), {
      target: { value: "admin" },
    });

    fireEvent.change(screen.getByTestId("password-input"), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByTestId("login-button"));

    expect(mockLogin).toHaveBeenCalledWith({
      username: "admin",
      password: "123456",
      role: "cashier",
    });
  });
});