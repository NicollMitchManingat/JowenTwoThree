import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import DateRangeFilter from "../components/DateRangeFilter";

describe("DateRangeFilter", () => {
  it("should update the start date", () => {
    const setStartDate = vi.fn();

    render(
      <DateRangeFilter
        startDate=""
        endDate=""
        setStartDate={setStartDate}
        setEndDate={() => {}}
      />
    );

    fireEvent.change(screen.getAllByDisplayValue("")[0], {
      target: { value: "2026-06-30" },
    });

    expect(setStartDate).toHaveBeenCalled();
  });

  it("should update the end date", () => {
    const setEndDate = vi.fn();

    render(
      <DateRangeFilter
        startDate=""
        endDate=""
        setStartDate={() => {}}
        setEndDate={setEndDate}
      />
    );

    fireEvent.change(screen.getAllByDisplayValue("")[1], {
      target: { value: "2026-07-05" },
    });

    expect(setEndDate).toHaveBeenCalled();
  });
});