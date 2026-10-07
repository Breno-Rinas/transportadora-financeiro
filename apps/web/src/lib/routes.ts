import type { DueBucket, TitleKind, TitleNature, TripFilters } from '../api/types';

/** Caminhos das telas, para links e navegação sem texto solto espalhado. */
export const paths = {
  dashboard: '/',
  trips: '/viagens',
  trip: (id: string) => `/viagens/${id}`,
  finance: '/financeiro',
  clients: '/clientes',
  drivers: '/motoristas',
} as const;

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const text = search.toString();
  return text ? `${path}?${text}` : path;
}

/**
 * Filtros da querystring de `/financeiro` (contrato com a tela Financeiro). Os nomes espelham
 * `TitleFilters` da API; `bucket` é a faixa (`DueBucket`) que a tela destaca no quadro.
 */
export interface FinanceLinkParams {
  nature?: TitleNature;
  kind?: TitleKind;
  bucket?: DueBucket;
  /** `true` -> `locked=true`: só títulos com motivo de trava. */
  locked?: boolean;
}

export function financePath({ nature, kind, bucket, locked }: FinanceLinkParams = {}): string {
  return withQuery(paths.finance, {
    nature,
    kind,
    bucket,
    locked: locked ? 'true' : undefined,
  });
}

/** Filtros da querystring de `/viagens`: os mesmos nomes de `TripFilters`. */
export function tripsPath(filters: TripFilters = {}): string {
  return withQuery(paths.trips, { ...filters });
}
