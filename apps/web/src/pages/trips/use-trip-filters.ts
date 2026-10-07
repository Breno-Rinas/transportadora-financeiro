import { useDebouncedValue } from '@mantine/hooks';
import { useSearchParams } from 'react-router';
import type { TripFilters, TripStatus } from '../../api/types';
import { TRIP_STATUSES } from '../../lib/labels';

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEARCH_DEBOUNCE_MS = 300;

type FilterKey = 'q' | 'status' | 'clientId' | 'driverId' | 'from' | 'to';

function toStatus(value: string | null): TripStatus | undefined {
  return TRIP_STATUSES.find((status) => status === value);
}

function toLocalDate(value: string | null): string | undefined {
  return value && LOCAL_DATE.test(value) ? value : undefined;
}

/**
 * Filtros da lista de viagens na querystring (`?q&status&clientId&driverId&from&to`), para que o
 * link, o botão voltar e o painel (KPIs) reproduzam a mesma tela. O texto da busca vai direto
 * para a URL (o input responde na hora); só a consulta usa o valor com debounce.
 */
export function useTripFilters() {
  const [params, setParams] = useSearchParams();

  const search = params.get('q') ?? '';
  const [debouncedSearch] = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const status = toStatus(params.get('status'));
  const clientId = params.get('clientId') || undefined;
  const driverId = params.get('driverId') || undefined;
  const from = toLocalDate(params.get('from'));
  const to = toLocalDate(params.get('to'));

  const filters: TripFilters = {
    q: debouncedSearch || undefined,
    status,
    clientId,
    driverId,
    from,
    to,
  };

  /** Altera vários filtros de uma vez (valor vazio remove o filtro) sem empilhar histórico. */
  function setFilters(updates: Partial<Record<FilterKey, string | null>>) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }

  function setFilter(key: FilterKey, value: string | null | undefined) {
    setFilters({ [key]: value });
  }

  function clear() {
    setParams({}, { replace: true });
  }

  return {
    search,
    status,
    clientId,
    driverId,
    from,
    to,
    /** Filtros para `useTrips`. */
    filters,
    hasFilters: Boolean(search.trim() || status || clientId || driverId || from || to),
    setFilter,
    setFilters,
    clear,
  };
}
