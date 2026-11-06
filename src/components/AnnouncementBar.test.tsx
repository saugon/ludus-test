import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnnouncementBar } from './AnnouncementBar';

// En mobile se ve solo el mensaje activo; los demás quedan para lectores de pantalla (max-md:sr-only).
function visible() {
  return screen.getAllByRole('listitem').filter((item) => !item.className.includes('sr-only')).map((item) => item.textContent);
}

describe('the announcement bar', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the three messages readable and rotates the one shown on mobile', () => {
    render(<AnnouncementBar />);

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(visible()).toEqual(['Stock actualizado semanalmente']);
    act(() => vi.advanceTimersByTime(4000));
    expect(visible()).toEqual(['Envíos a todo el país']);
  });

  it('pauses while the pointer is over it', () => {
    render(<AnnouncementBar />);

    fireEvent.mouseEnter(screen.getByRole('list').parentElement!);
    act(() => vi.advanceTimersByTime(12000));
    expect(visible()).toEqual(['Stock actualizado semanalmente']);
  });

  it('does not rotate when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
    render(<AnnouncementBar />);

    act(() => vi.advanceTimersByTime(12000));
    expect(visible()).toEqual(['Stock actualizado semanalmente']);
  });
});
