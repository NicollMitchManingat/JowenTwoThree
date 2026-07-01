import React from 'react';

export default function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="modal-overlay"
        onClick={onClose}
        data-testid="modal-overlay"
        role="presentation"
      />
      <div
        className="modal"
        data-testid="modal"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            data-testid="modal-close-btn"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="modal-content">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </>
  );
};
