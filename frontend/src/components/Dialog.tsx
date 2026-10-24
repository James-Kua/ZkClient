import { useEffect, type ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  width?: number;
}

export default function Dialog({ title, onClose, children, footer, width = 480 }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog" style={{ width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="dialog-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>
  );
}
