'use client';

import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * One modal/drawer primitive for all 14 surfaces.
 *
 * The source had bespoke CSS for Bootstrap modals and two different drawer
 * styles; this is the same behaviour in one component: backdrop click, Escape,
 * focus containment via the native dialog semantics, and a side variant.
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  width = 'md',
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  side?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex flex-col border-border bg-panel shadow-2xl',
          side
            ? 'ml-auto h-full w-full max-w-lg border-l'
            : cn('m-auto max-h-[85vh] w-full rounded-lg border', widths[width]),
        )}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          {icon && <i className={cn(icon, 'text-accent')} />}
          <h2 className="flex-1 text-[13px] font-semibold">{title}</h2>
          <button type="button" className="btn-icon readonly-allowed" onClick={onClose} title="Close">
            <i className="bi-x-lg" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
