import { useSearchParams } from 'react-router';
import type { DueBucket, TitleFilters, TitleKind, TitleNature } from '../../api/types';
import { DUE_BUCKET_ORDER, TITLE_KIND_ORDER, TITLE_NATURES } from '../../lib/labels';

type FilterKey = 'nature' | 'kind' | 'locked' | 'bucket' | 'q';

function toNature(value: string | null): TitleNature {
  return TITLE_NATURES.find((nature) => nature === value) ?? 'PAYABLE';
}

function toKind(value: string | null): TitleKind | undefined {
  return TITLE_KIND_ORDER.find((kind) => kind === value);
}

function toBucket(value: string | null): DueBucket | undefined {
  return DUE_BUCKET_ORDER.find((bucket) => bucket === value);
}

/**
 * Filtros do Financeiro na querystring (`?nature&kind&locked&bucket&q`), para que o link, o botão
 * voltar e o painel (KPIs) reproduzam a mesma tela. `nature` (aba) vale `PAYABLE` quando ausente.
 * `bucket` só destaca e rola até a coluna; `q` filtra o texto na tela (a API de títulos não busca).
 */
export function useFinanceFilters() {
  const [params, setParams] = useSearchParams();

  const nature = toNature(params.get('nature'));
  const kind = toKind(params.get('kind'));
  const locked = params.get('locked') === 'true';
  const bucket = toBucket(params.get('bucket'));
  const search = params.get('q') ?? '';

  /** Filtros enviados à API (`GET /titles`) e ao CSV. */
  const filters: TitleFilters = { nature, kind, locked: locked || undefined };

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

  /** Mantém a aba e apaga espécie, travados, faixa e busca. */
  function clearFilters() {
    setFilters({ kind: null, locked: null, bucket: null, q: null });
  }

  return {
    nature,
    kind,
    locked,
    bucket,
    search,
    filters,
    hasFilters: Boolean(kind || locked || bucket || search.trim()),
    setFilters,
    clearFilters,
  };
}
