import { render, screen } from "@testing-library/react";
import LoadingSkeleton from "../components/LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("should render the loading skeleton", () => {
    render(<LoadingSkeleton />);

    expect(
      screen.getByTestId("loading-skeleton")
    ).toBeInTheDocument();
  });
});