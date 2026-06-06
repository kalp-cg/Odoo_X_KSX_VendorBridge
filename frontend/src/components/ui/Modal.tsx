'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={() => closeOnBackdrop && onClose()}
        aria-hidden
      />
      <div className={cn('relative w-full bg-white rounded-2xl shadow-card border border-ink-100 flex flex-col max-h-[90vh]', SIZE[size])}>
        {(title || description) && (
          <div className="px-5 py-4 border-b border-ink-100 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {title && <h3 className="text-base font-semibold text-ink-800">{title}</h3>}
              {description && <p className="text-sm text-ink-500 mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 -m-1">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto vb-scroll">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-ink-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
