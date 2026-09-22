import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import RadialFabMenu from "../components/pos/RadialFabMenu";

const handlers = () => ({
  onToggle: vi.fn(),
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onRemoved: vi.fn(),
});

describe("RadialFabMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the closed main button with no actions", () => {
    render(<RadialFabMenu open={false} manageMode="idle" {...handlers()} />);

    const main = screen.getByTestId("radial-fab-main");
    expect(main).toHaveAttribute("aria-expanded", "false");
    expect(main).toHaveAttribute("aria-label", "Open product options");
    expect(screen.queryByTestId("radial-fab-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fab-scrim")).not.toBeInTheDocument();
  });

  it("should fan out 4 actions up-left with staggered delays when open", () => {
    render(<RadialFabMenu open manageMode="idle" {...handlers()} />);

    const add = screen.getByTestId("radial-fab-add");
    const edit = screen.getByTestId("radial-fab-edit");
    const del = screen.getByTestId("radial-fab-delete");
    const removed = screen.getByTestId("radial-fab-removed");

    // Add straight up, Removed hard left (quarter-fan up-left)
    expect(add.parentElement.style.transform).toContain("rotate(-90deg)");
    expect(removed.parentElement.style.transform).toContain("rotate(-180deg)");
    expect(edit.parentElement.style.transform).toContain("rotate(-120deg)");
    expect(del.parentElement.style.transform).toContain("rotate(-150deg)");

    // Staggered cascade entrance
    expect(add.parentElement.style.animationDelay).toBe("0ms");
    expect(removed.parentElement.style.animationDelay).toBe("120ms");

    expect(screen.getByTestId("radial-fab-main")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("fab-scrim")).toBeInTheDocument();
  });

  it("should call the matching handler for each action", () => {
    const h = handlers();
    render(<RadialFabMenu open manageMode="idle" {...h} />);

    fireEvent.click(screen.getByTestId("radial-fab-add"));
    fireEvent.click(screen.getByTestId("radial-fab-edit"));
    fireEvent.click(screen.getByTestId("radial-fab-delete"));
    fireEvent.click(screen.getByTestId("radial-fab-removed"));

    expect(h.onAdd).toHaveBeenCalledTimes(1);
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onDelete).toHaveBeenCalledTimes(1);
    expect(h.onRemoved).toHaveBeenCalledTimes(1);
  });

  it("should show the hover chip with the action label", () => {
    render(<RadialFabMenu open manageMode="idle" {...handlers()} />);

    expect(screen.queryByTestId("radial-fab-chip-add")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId("radial-fab-add"));
    const chip = screen.getByTestId("radial-fab-chip-add");
    expect(chip).toHaveTextContent("Add product");
    expect(chip).toHaveAttribute("role", "tooltip");
    fireEvent.mouseLeave(screen.getByTestId("radial-fab-add"));
    expect(screen.queryByTestId("radial-fab-chip-add")).not.toBeInTheDocument();
  });

  it("should close via scrim and main button", () => {
    const h = handlers();
    render(<RadialFabMenu open manageMode="idle" {...h} />);

    fireEvent.click(screen.getByTestId("fab-scrim"));
    fireEvent.click(screen.getByTestId("radial-fab-main"));
    expect(h.onToggle).toHaveBeenCalledTimes(2);
  });

  it("should hide actions and offer select-mode exit when managing", () => {
    render(<RadialFabMenu open manageMode="delete" {...handlers()} />);

    expect(screen.queryByTestId("radial-fab-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fab-scrim")).not.toBeInTheDocument();
    expect(screen.getByTestId("radial-fab-main")).toHaveAttribute("aria-label", "Exit select mode");
  });

  it("should place each chip outward along its own ray with complete positioning", () => {
    render(<RadialFabMenu open manageMode="idle" {...handlers()} />);

    const cases = [
      ["add", "above", "radial-fab-chip-above"],
      ["edit", "upper-left", "radial-fab-chip-upper-left"],
      ["delete", "left", "radial-fab-chip-left"],
      ["removed", "left", "radial-fab-chip-left"],
    ];
    for (const [key, side, sideClass] of cases) {
      fireEvent.mouseEnter(screen.getByTestId(`radial-fab-${key}`));
      const chip = screen.getByTestId(`radial-fab-chip-${key}`);
      expect(chip).toHaveAttribute("data-chip-side", side);
      expect(chip).toHaveClass("radial-fab-chip", sideClass);
      // Positioning comes solely from the side class: no inline offsets
      // may leak through and over-constrain the box.
      expect(chip.getAttribute("style")).toBeNull();
      fireEvent.mouseLeave(screen.getByTestId(`radial-fab-${key}`));
    }
  });

  describe("closing animation", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should play a reverse cascade before unmounting minis", () => {
      vi.useFakeTimers();
      const { rerender } = render(<RadialFabMenu open manageMode="idle" {...handlers()} />);
      expect(screen.getByTestId("radial-fab-add")).toBeInTheDocument();

      rerender(<RadialFabMenu open={false} manageMode="idle" {...handlers()} />);

      // Minis linger with the closing class, folding in reverse order
      const addOrbit = screen.getByTestId("radial-fab-add").parentElement;
      const removedOrbit = screen.getByTestId("radial-fab-removed").parentElement;
      expect(addOrbit).toHaveClass("radial-fab-orbit-closing");
      expect(removedOrbit).toHaveClass("radial-fab-orbit-closing");
      expect(removedOrbit.style.animationDelay).toBe("0ms");
      expect(addOrbit.style.animationDelay).toBe("90ms");
      expect(screen.getByTestId("fab-scrim")).toBeInTheDocument();

      // Mid-close the minis are still mounted, holding the shrink end-state
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.queryByTestId("radial-fab-add")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(120);
      });
      expect(screen.queryByTestId("radial-fab-add")).not.toBeInTheDocument();
      expect(screen.queryByTestId("fab-scrim")).not.toBeInTheDocument();
    });

    it("should cancel the close when reopened mid-animation", () => {
      vi.useFakeTimers();
      const h = handlers();
      const { rerender } = render(<RadialFabMenu open manageMode="idle" {...h} />);

      rerender(<RadialFabMenu open={false} manageMode="idle" {...h} />);
      expect(screen.getByTestId("radial-fab-add").parentElement).toHaveClass("radial-fab-orbit-closing");

      rerender(<RadialFabMenu open manageMode="idle" {...h} />);
      expect(screen.getByTestId("radial-fab-add").parentElement).not.toHaveClass("radial-fab-orbit-closing");

      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByTestId("radial-fab-add")).toBeInTheDocument();
    });

    it("should unmount immediately under reduced motion", () => {
      vi.useFakeTimers();
      const matchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });
      try {
        const { rerender } = render(<RadialFabMenu open manageMode="idle" {...handlers()} />);
        rerender(<RadialFabMenu open={false} manageMode="idle" {...handlers()} />);
        expect(screen.queryByTestId("radial-fab-add")).not.toBeInTheDocument();
      } finally {
        window.matchMedia = matchMedia;
      }
    });
  });
});
