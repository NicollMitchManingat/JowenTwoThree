import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CustomerRecordingButton from "../components/CustomerRecordingButton";

describe("CustomerRecordingButton", () => {
  it("should display default customer count as 1", () => {
    render(<CustomerRecordingButton />);

    expect(
      screen.getByTestId("customer-count")
    ).toHaveTextContent("1");
  });

  it("should increase customer count when + button is clicked", () => {
    render(<CustomerRecordingButton />);

    fireEvent.click(
      screen.getByLabelText("Increase Customer Count")
    );

    expect(
      screen.getByTestId("customer-count")
    ).toHaveTextContent("2");
  });

  it("should decrease customer count when - button is clicked", () => {
    render(<CustomerRecordingButton />);

    fireEvent.click(
      screen.getByLabelText("Increase Customer Count")
    );

    fireEvent.click(
      screen.getByLabelText("Decrease Customer Count")
    );

    expect(
      screen.getByTestId("customer-count")
    ).toHaveTextContent("1");
  });
  
  it("should not decrease customer count below 1", () => {
  render(<CustomerRecordingButton />);

  expect(
    screen.getByTestId("customer-count")
  ).toHaveTextContent("1");

  fireEvent.click(
    screen.getByLabelText("Decrease Customer Count")
  );

  expect(
    screen.getByTestId("customer-count")
  ).toHaveTextContent("1");
});

  it("should render the customer count title", () => {
    render(<CustomerRecordingButton />);

    expect(
      screen.getByText("Customer Count")
    ).toBeInTheDocument();
  });
});