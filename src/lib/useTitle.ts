import { useEffect } from 'react';

const SITE = 'Ludus Game Store';

export function useTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} · Wargames y miniaturas en Buenos Aires`;
  }, [title]);
}
