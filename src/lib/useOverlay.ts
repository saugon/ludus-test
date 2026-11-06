import { useEffect, useRef } from 'react';

let locks = 0;

export function useOverlay<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const panel = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    locks += 1;
    if (locks === 1) {
      body.style.overflow = 'hidden';
      body.style.paddingRight = gap > 0 ? `${gap}px` : '';
    }

    const node = panel.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node;
    first?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close.current();
        return;
      }
      if (event.key !== 'Tab' || !node) return;
      const focusable = [...node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const start = focusable[0];
      const end = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      locks -= 1;
      if (locks === 0) {
        body.style.overflow = '';
        body.style.paddingRight = '';
      }
      previous?.focus?.();
    };
  }, [open]);

  return panel;
}
