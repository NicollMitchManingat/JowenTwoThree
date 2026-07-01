import { render, screen } from "@testing-library/react";
import SalesTrendChart from "../components/SalesTrendChart";

describe("SalesTrendChart", () => {
  it("should render the sales trend chart", () => {
    render(<SalesTrendChart />);

    expect(
      screen.getByTestId("sales-chart")
    ).toBeInTheDocument();
  });
});