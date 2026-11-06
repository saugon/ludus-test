import { useState } from 'react';
import { asset } from '../lib/paths';

type Props = {
  src: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
};

export function ProductImage({ src, alt, className = '', eager = false }: Props) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        role="img"
        aria-label={alt ? `${alt}, sin foto` : 'Producto sin foto'}
        className={`flex items-center justify-center bg-ink-3 ${className}`}
      >
        <img src={asset('/logo.svg')} alt="" className="w-1/3 opacity-25 grayscale" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setBroken(true)}
      className={`bg-ink-3 object-cover ${className}`}
    />
  );
}
