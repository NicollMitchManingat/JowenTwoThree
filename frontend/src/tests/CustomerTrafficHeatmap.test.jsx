import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CustomerTrafficHeatmap, { FALLBACK_TRAFFIC } from "../components/analytics/CustomerTrafficHeatmap";
import { db } from "../services/db";

vi.mock("../services/db", () => ({
  db: { getHourlyTraffic: vi.fn() },
}));

const toHourly = (arr) => arr.map((customers, hour) => ({ hour, customers }));

describe("CustomerTrafficHeatmap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render all 24 hourly blocks from live data", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap startDate="2026-09-01T00:00:00.000Z" endDate="2026-09-22T23:59:59.999Z" />);

    await waitFor(() => expect(screen.getByTestId("traffic-heatmap")).toBeInTheDocument());
    expect(db.getHourlyTraffic).toHaveBeenCalledWith(
      "2026-09-01T00:00:00.000Z",
      "2026-09-22T23:59:59.999Z"
    );
    for (let hour = 0; hour < 24; hour += 1) {
      expect(screen.getByTestId(`traffic-cell-${hour}`)).toBeInTheDocument();
    }
  });

  it("should display live traffic values with peak summary and legend", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-summary")).toBeInTheDocument());
    // Peak is hour 13 (1pm) with 22 customers in the fallback matrix
    expect(screen.getByTestId("traffic-summary")).toHaveTextContent(/Peak:/);
    expect(screen.getByTestId("traffic-summary")).toHaveTextContent("1pm");
    expect(screen.getByTestId("traffic-cell-13")).toHaveTextContent("22");
    expect(screen.getByTestId("traffic-cell-20")).toHaveTextContent("17");
    expect(screen.getByTestId("traffic-legend")).toBeInTheDocument();
  });

  it("should show count + % tooltip on hover with accessible label", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-13")).toBeInTheDocument());
    const cell = screen.getByTestId("traffic-cell-13");
    expect(cell).toHaveAttribute("aria-label", expect.stringContaining("22 customers"));
    expect(cell).toHaveAttribute("aria-label", expect.stringContaining("% of day"));

    fireEvent.mouseEnter(cell);
    expect(screen.getByTestId("traffic-tooltip-13")).toHaveTextContent(/22 customers \(.+% of day\)/);
    fireEvent.mouseLeave(cell);
    expect(screen.queryByTestId("traffic-tooltip-13")).not.toBeInTheDocument();
  });

  it("should fall back to sample data and offer retry on fetch failure", async () => {
    db.getHourlyTraffic.mockRejectedValueOnce(new Error("Supabase waking up"));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-error")).toBeInTheDocument());
    // Fallback matrix still renders so the dashboard never goes blank
    expect(screen.getByTestId("traffic-cell-13")).toHaveTextContent("22");

    db.getHourlyTraffic.mockResolvedValueOnce(toHourly(new Array(24).fill(1)));
    fireEvent.click(screen.getByTestId("traffic-retry"));
    await waitFor(() => expect(db.getHourlyTraffic).toHaveBeenCalledTimes(2));
  });

  it("should show empty state when no traffic exists", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(new Array(24).fill(0)));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-empty")).toBeInTheDocument());
    expect(screen.getByTestId("traffic-empty")).toHaveTextContent(/No traffic recorded/);
  });

  it("should keep all content inside the container without overflow styles", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-heatmap")).toBeInTheDocument());
    const root = screen.getByTestId("traffic-heatmap");
    expect(root.style.overflow).toBe("hidden");
    expect(root.style.maxWidth).toBe("100%");
    // Grid must use minmax(0, 1fr) so narrow columns shrink instead of spilling
    const grid = screen.getByTestId("traffic-cell-0").parentElement;
    expect(grid.style.gridTemplateColumns).toContain("minmax(0, 1fr)");
    // Cells stay visible so hover tooltips paint; long labels are clipped
    // by the inner label element, not the cell box
    const cell = screen.getByTestId("traffic-cell-13");
    expect(cell.style.overflow).toBe("visible");
    expect(cell.style.maxWidth).toBe("100%");
  });

  it("should flip edge-cell tooltips inward so they stay inside the container", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-0")).toBeInTheDocument());
    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-0"));
    const leftTip = screen.getByTestId("traffic-tooltip-0");
    expect(leftTip).toHaveAttribute("data-align", "left");
    expect(leftTip.style.whiteSpace).not.toBe("nowrap");
    expect(leftTip.style.maxWidth).toBe("180px");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-0"));

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-5"));
    expect(screen.getByTestId("traffic-tooltip-5")).toHaveAttribute("data-align", "right");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-5"));

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-13"));
    expect(screen.getByTestId("traffic-tooltip-13")).toHaveAttribute("data-align", "center");
  });

  it("should flip tooltips vertically so top rows open below and bottom rows above", async () => {
    db.getHourlyTraffic.mockResolvedValue(toHourly(FALLBACK_TRAFFIC));
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-cell-0")).toBeInTheDocument());
    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-2"));
    const belowTip = screen.getByTestId("traffic-tooltip-2");
    expect(belowTip).toHaveAttribute("data-placement", "below-center");
    expect(belowTip.style.top).toBe("calc(100% + 6px)");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-2"));

    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-20"));
    const aboveTip = screen.getByTestId("traffic-tooltip-20");
    expect(aboveTip).toHaveAttribute("data-placement", "above-center");
    expect(aboveTip.style.bottom).toBe("calc(100% + 6px)");
    fireEvent.mouseLeave(screen.getByTestId("traffic-cell-20"));

    // Corner cell combines both flips and stays inside the card
    fireEvent.mouseEnter(screen.getByTestId("traffic-cell-23"));
    expect(screen.getByTestId("traffic-tooltip-23")).toHaveAttribute("data-placement", "above-right");
  });

  it("should wrap long error text instead of spilling outside", async () => {
    db.getHourlyTraffic.mockRejectedValueOnce(
      new Error("SupabaseMediawigwamMediawigwamMediawigwamMediawigwamMediawigwamTimeout".repeat(4))
    );
    render(<CustomerTrafficHeatmap />);

    await waitFor(() => expect(screen.getByTestId("traffic-error")).toBeInTheDocument());
    expect(screen.getByTestId("traffic-error").style.overflowWrap).toBe("anywhere");
  });
});
