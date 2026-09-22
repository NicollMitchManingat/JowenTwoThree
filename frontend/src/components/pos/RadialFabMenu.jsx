import { useEffect, useRef, useState } from "react";
import { Plus, X, Edit, Trash2, Archive } from "lucide-react";

// Quarter-fan angles (CSS degrees, clockwise positive) fanning up-left from
// the main button: Add straight up, then Edit / Delete / Removed sweeping left.
// Each chip sits outward along its own ray so no bubble ever slides under
// another button (orbit transforms create stacking contexts, so z-index alone
// cannot fix cross-orbit overlap).
const ACTIONS = [
  {
    key: "add", label: "Add product", title: "Add product", icon: Plus, angle: -90,
    chipSide: "above",
  },
  {
    key: "edit", label: "Edit a product", title: "Edit a product", icon: Edit, angle: -120,
    chipSide: "upper-left",
  },
  {
    key: "delete", label: "Remove products", title: "Remove products", icon: Trash2, angle: -150,
    chipSide: "left",
  },
  {
    key: "removed", label: "View removed products", title: "View removed products", icon: Archive, angle: -180,
    chipSide: "left",
  },
];

const CLOSE_MS = 300;

export default function RadialFabMenu({
  open,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onRemoved,
  manageMode = "idle",
}) {
  const [hovered, setHovered] = useState(null);
  const [showMinis, setShowMinis] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const shownRef = useRef(false);
  const inSelectMode = manageMode !== "idle";
  const handlers = { add: onAdd, edit: onEdit, delete: onDelete, removed: onRemoved };

  useEffect(() => {
    if (open) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      shownRef.current = true;
      setClosing(false);
      setShowMinis(true);
    } else {
      setHovered(null);
      if (!shownRef.current) return;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        shownRef.current = false;
        setShowMinis(false);
        return;
      }
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        shownRef.current = false;
        setShowMinis(false);
        setClosing(false);
      }, CLOSE_MS);
    }
  }, [open ]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const mainLabel = inSelectMode
    ? "Exit select mode"
    : open
      ? "Close product options"
      : "Open product options";

  const showActions = showMinis && !inSelectMode;

  return (
    <div className="radial-fab" data-testid="radial-fab">
      {showActions && (
        <button
          type="button"
          aria-label="Close product options"
          data-testid="fab-scrim"
          className="radial-fab-scrim"
          onClick={onToggle}
        />
      )}
      {showActions &&
        ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <div
              key={action.key}
              className={`radial-fab-orbit${closing ? " radial-fab-orbit-closing" : ""}`}
              style={{
                transform: `rotate(${action.angle}deg) translate(var(--fab-radius, 88px)) rotate(${-action.angle}deg)`,
                animationDelay: closing
                  ? `${(ACTIONS.length - 1 - i) * 30}ms`
                  : `${i * 40}ms`,
                zIndex: hovered === action.key ? 5 : undefined,
              }}
            >
              <button
                type="button"
                className="radial-fab-mini"
                data-testid={`radial-fab-${action.key}`}
                title={action.title}
                aria-label={action.label}
                onClick={handlers[action.key]}
                onMouseEnter={() => setHovered(action.key)}
                onMouseLeave={() => setHovered((h) => (h === action.key ? null : h))}
                onFocus={() => setHovered(action.key)}
                onBlur={() => setHovered((h) => (h === action.key ? null : h))}
              >
                <Icon size={18} />
              </button>
              {(hovered === action.key) && (
                <span
                  role="tooltip"
                  data-testid={`radial-fab-chip-${action.key}`}
                  data-chip-side={action.chipSide}
                  className={`radial-fab-chip radial-fab-chip-${action.chipSide}`}
                >
                  {action.label}
                </span>
              )}
            </div>
          );
        })}
      <button
        type="button"
        className="add-product-fab radial-fab-main"
        data-testid="radial-fab-main"
        onClick={onToggle}
        title={inSelectMode ? "Exit select mode" : open ? "Close" : "Manage products"}
        aria-expanded={open}
        aria-label={mainLabel}
      >
        {inSelectMode || open ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  );
}
