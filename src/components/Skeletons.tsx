// Mismo formato que las tarjetas de producto: 4:5 con el rayado.
export function CardSkeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`stripes aspect-[4/5] animate-pulse rounded-xl border border-line-soft bg-ink-3 ${className}`} />;
}

export function LoadingLabel({ children }: { children: string }) {
  return (
    <p role="status" className="sr-only">
      {children}
    </p>
  );
}
