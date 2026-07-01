import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../components/Modal';

describe('Modal Component', () => {
  it('does not render when isOpen is false', () => {
    const mockOnClose = vi.fn();
    const { container } = render(
      <Modal isOpen={false} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const modal = container.querySelector('.modal');
    expect(modal).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const modal = screen.getByTestId('modal');
    expect(modal).toBeInTheDocument();
  });

  it('displays modal title', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
  });

  it('displays modal content', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content Here</div>
      </Modal>
    );
    expect(screen.getByText('Modal Content Here')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const closeBtn = screen.getByTestId('modal-close-btn');
    await user.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const overlay = screen.getByTestId('modal-overlay');
    await user.click(overlay);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders footer when provided', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={mockOnClose}
        title="Test Modal"
        footer={<div>Footer Content</div>}
      >
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByText('Footer Content')).toBeInTheDocument();
  });

  it('does not render footer when not provided', () => {
    const mockOnClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const footer = container.querySelector('.modal-footer');
    expect(footer).not.toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const modal = screen.getByTestId('modal');
    expect(modal).toHaveAttribute('role', 'dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('close button has proper accessibility attributes', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const closeBtn = screen.getByTestId('modal-close-btn');
    expect(closeBtn).toHaveAttribute('aria-label', 'Close modal');
  });

  it('renders modal overlay', () => {
    const mockOnClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={mockOnClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    const overlay = screen.getByTestId('modal-overlay');
    expect(overlay).toBeInTheDocument();
  });
});
