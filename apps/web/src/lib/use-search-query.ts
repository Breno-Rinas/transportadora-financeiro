import { useDebouncedValue } from '@mantine/hooks';
import { useSearchParams } from 'react-router';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Busca textual guardada na querystring (`?q=`): o input responde na hora (`search`) e a
 * consulta usa o valor com debounce (`query`, `undefined` quando vazio).
 */
export function useSearchQuery() {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [debounced] = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  function setSearch(value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }

  return { search, setSearch, query: debounced || undefined };
}
