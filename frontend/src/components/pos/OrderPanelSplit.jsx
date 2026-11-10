import { Children, useCallback, useEffect, useId, useRef, useState } from 'react';

const STORAGE_KEY = 'jowen-pos-order-split-v1';
const DEFAULT_SHARE = 45;
const clamp = (value, limits) => Math.min(limits.max, Math.max(limits.min, value));

function readPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const share = Number(value);
    if (value?.trim() && Number.isFinite(share) && share > 0 && share <= 90) return share;
  } catch { /* Storage is optional on shared/private devices. */ }
  return DEFAULT_SHARE;
}

function persist(share) {
  try { localStorage.setItem(STORAGE_KEY, String(share)); } catch { /* Keep resizing usable without storage. */ }
}

function geometry(frame, divider, minimumItemsHeight) {
  const available = frame.getBoundingClientRect().height - divider.getBoundingClientRect().height;
  if (available <= 0) return { available: 0, min: 10, max: 90 };
  return {
    available,
    min: Math.min(minimumItemsHeight, available * 0.35) / available * 100,
    max: Math.min(90, Math.floor(100 - Math.min(160, available * 0.55) / available * 100)),
  };
}

export default function OrderPanelSplit({ children, minimumItemsHeight = 80 }) {
  const panels = Children.toArray(children);
  const id = useId();
  const frameRef = useRef(null);
  const dividerRef = useRef(null);
  const dragRef = useRef(null);
  const [preferred, setPreferred] = useState(readPreference);
  const [limits, setLimits] = useState({ min: 10, max: 90 });
  const [dragging, setDragging] = useState(false);
  const share = clamp(preferred, limits);

  const finishDrag = useCallback((commit) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    document.body.classList.remove('pos-order-resizing');
    setDragging(false);
    if (commit) {
      setPreferred(drag.value);
      persist(drag.value);
    } else setPreferred(drag.original);
    try { drag.handle.releasePointerCapture(drag.pointerId); } catch { /* Capture may already be released. */ }
  }, []);

  useEffect(() => {
    const measure = () => {
      const next = geometry(frameRef.current, dividerRef.current, minimumItemsHeight);
      const drag = dragRef.current;
      if (drag && (Math.abs(next.available - drag.available) > 1 || next.min !== drag.min || next.max !== drag.max)) finishDrag(false);
      setLimits(previous => previous.min === next.min && previous.max === next.max
        ? previous : { min: next.min, max: next.max });
    };
    const cancel = () => finishDrag(false);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(frameRef.current);
    observer?.observe(dividerRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('blur', cancel);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('blur', cancel);
    };
  }, [finishDrag, minimumItemsHeight]);

  useEffect(() => () => {
    const drag = dragRef.current;
    dragRef.current = null;
    document.body.classList.remove('pos-order-resizing');
    if (drag) {
      try { drag.handle.releasePointerCapture(drag.pointerId); } catch { /* Unmounted handle. */ }
    }
  }, []);

  const startDrag = event => {
    if (event.button !== 0 || event.isPrimary === false || dragRef.current) return;
    const next = geometry(frameRef.current, dividerRef.current, minimumItemsHeight);
    if (!next.available) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const startShare = clamp(preferred, next);
    dragRef.current = {
      pointerId: event.pointerId, startY: event.clientY, startShare,
      original: preferred, value: startShare, available: next.available,
      min: next.min, max: next.max, handle: event.currentTarget,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Unsupported capture. */ }
    document.body.classList.add('pos-order-resizing');
    setDragging(true);
  };

  const moveDrag = event => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.value = clamp(drag.startShare + (event.clientY - drag.startY) / drag.available * 100, drag);
    setPreferred(drag.value);
  };

  const reset = () => {
    finishDrag(false);
    setPreferred(DEFAULT_SHARE);
    persist(DEFAULT_SHARE);
  };

  const handleKey = event => {
    if (event.key === 'Escape' && dragRef.current) {
      event.preventDefault();
      event.stopPropagation();
      finishDrag(false);
      return;
    }
    if (dragRef.current) return;
    const step = event.shiftKey ? 10 : 5;
    const values = { ArrowUp: share - step, ArrowDown: share + step, Home: limits.min, End: limits.max };
    if (event.key === 'Enter') {
      event.preventDefault();
      reset();
    } else if (Object.hasOwn(values, event.key)) {
      event.preventDefault();
      const next = clamp(values[event.key], limits);
      setPreferred(next);
      persist(next);
    }
  };

  return (
    <div ref={frameRef} className={`order-panel-split${dragging ? ' is-resizing' : ''}`}
      style={{ '--order-items-row': `${share}fr`, '--order-payment-row': `${100 - share}fr` }}>
      <div id={`${id}-items`} className="order-split-pane">{panels[0]}</div>
      <div ref={dividerRef} className="order-panel-divider" role="separator" tabIndex={0}
        aria-label="Resize current order and payment sections" aria-orientation="horizontal"
        aria-controls={`${id}-items ${id}-payment`} aria-describedby={`${id}-hint`}
        aria-valuemin={limits.min} aria-valuemax={limits.max} aria-valuenow={share}
        aria-valuetext={`${Math.round(share)}% for order items`}
        title="Drag to resize. Double-click or press Enter to reset."
        onPointerDown={startDrag} onPointerMove={moveDrag}
        onPointerUp={event => { if (dragRef.current?.pointerId === event.pointerId) finishDrag(true); }}
        onPointerCancel={event => { if (dragRef.current?.pointerId === event.pointerId) finishDrag(false); }}
        onLostPointerCapture={() => finishDrag(false)} onDoubleClick={reset} onKeyDown={handleKey}>
        <span className="order-panel-divider-grip" aria-hidden="true" />
        <span id={`${id}-hint`} className="sr-only">Drag or use Up and Down arrows to resize. Press Enter to reset.</span>
      </div>
      <div id={`${id}-payment`} className="order-split-pane">{panels[1]}</div>
    </div>
  );
}
