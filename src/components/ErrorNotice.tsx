import type { ReactNode } from 'react';
import { describeError, type ErrorContext } from '../lib/errors';
import { AlertIcon } from './Icons';

type Props = {
  error: unknown;
  names?: Record<string, string>;
  context?: ErrorContext;
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
};

export function ErrorNotice({ error, names, context, onRetry, children, className = '' }: Props) {
  const view = describeError(error, names, context);

  return (
    <div role="alert" className={`rounded-lg border border-alert/40 bg-alert/10 p-4 ${className}`}>
      <div className="flex gap-3">
        <AlertIcon size={20} className="mt-0.5 shrink-0 text-alert" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{view.title}</p>
          <p className="text-mute">{view.message}</p>
          {view.hint && <p className="text-sm text-mute">{view.hint}</p>}
          {(children || (view.retry && onRetry)) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {children}
              {view.retry && onRetry && (
                <button type="button" onClick={onRetry} className="h-11 rounded-md border border-line px-4 font-semibold hover:border-mute">
                  Volver a intentar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
