import { useEffect, useId, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchIcon } from './Icons';

type Props = { className?: string; autoFocus?: boolean; onSearch?: () => void; size?: 'md' | 'lg' };

export function SearchForm({ className = '', autoFocus = false, onSearch, size = 'md' }: Props) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const current = params.get('q') ?? '';
  const [query, setQuery] = useState(current);
  const id = useId();

  useEffect(() => setQuery(current), [current]);

  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        const value = query.trim();
        if (value) next.set('q', value);
        const category = params.get('categoria');
        if (category && pathname === '/productos') next.set('categoria', category);
        navigate({ pathname: '/productos', search: next.toString() ? `?${next}` : '' });
        onSearch?.();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscá miniaturas, pinturas, codex…"
        autoFocus={autoFocus}
        enterKeyHint="search"
        className={`w-full text-ellipsis rounded-full border border-line-soft bg-ink-3 pl-4 pr-12 font-ui font-medium text-bone placeholder:text-dim focus:border-ember focus:outline-none ${size === 'lg' ? 'h-13 text-lg' : 'h-11 text-[0.88rem]'}`}
      />
      <button type="submit" className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-full text-dim hover:text-bone" aria-label="Buscar">
        <SearchIcon />
      </button>
    </form>
  );
}
