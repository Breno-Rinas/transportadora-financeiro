import type { DashboardQuery, TitleFilters, TripFilters } from './types';

/**
 * Chaves do TanStack Query (CLAUDE.md). Os filtros entram na chave como objeto, então
 * `invalidateQueries({ queryKey: ['trips'] })` pega todas as variações por prefixo.
 */
export const queryKeys = {
  dashboard: (query: DashboardQuery = {}) => ['dashboard', query] as const,
  trips: (filters: TripFilters) => ['trips', filters] as const,
  trip: (id: string) => ['trip', id] as const,
  titles: (filters: TitleFilters) => ['titles', filters] as const,
  clients: (q = '') => ['clients', { q }] as const,
  drivers: (q = '') => ['drivers', { q }] as const,

  /** Invalidadas por toda mutação, para o painel e as listas atualizarem sem recarregar. */
  alwaysInvalidated: [['dashboard'], ['trips'], ['trip'], ['titles']] as const,
} as const;
