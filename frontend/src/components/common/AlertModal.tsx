/**
 * AlertModal – single-message popup with OK to dismiss.
 * Used for logger error/warn UI transport (and any other single-message alerts).
 * Renders via portal to document.body so it always appears on top.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../../styles/alert-modal.css';

export interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  closeLabel?: string;
  variant?: 'error' | 'warn';
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  closeLabel = 'OK',
  variant = 'error',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const overlay = (
    <div
      className="alert-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div
        className={`alert-modal alert-modal--${variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="alert-modal-title" className="alert-modal-title">
          {title}
        </h2>
        <p className="alert-modal-message">{message}</p>
        <button
          type="button"
          className="alert-modal-ok"
          onClick={onClose}
          autoFocus
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};

export default AlertModal;
