import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print lm-modal-overlay">
      <div className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizeMap[size]} lm-card max-h-[90vh] flex flex-col lm-fade-up lm-modal-panel`}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--line)] shrink-0">
          <h3 className="text-lg font-extrabold text-[var(--ink)] truncate flex-1 mr-2">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-[var(--ink-soft)] hover:bg-[var(--cream-deep)] transition-colors shrink-0" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-[var(--line)] flex flex-wrap justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="lm-btn lm-btn-ghost px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
          <button
            className={`lm-btn px-4 py-2 text-sm ${danger ? 'bg-[#dc2626] text-white hover:bg-[#b91c1c]' : 'lm-btn-primary'}`}
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[var(--ink-soft)]">{message}</p>
    </Modal>
  );
}
