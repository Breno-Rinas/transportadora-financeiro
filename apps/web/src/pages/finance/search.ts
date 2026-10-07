import type { TitleListItem } from '../../api/types';
import { formatTripCode } from '../../lib/format';
import { TITLE_KIND_LABEL } from '../../lib/labels';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Texto pesquisável do título: nomes, código da viagem, rota e espécie. */
function searchableText(item: TitleListItem): string {
  const { trip } = item;
  return normalize(
    [
      trip.driver.name,
      trip.client.legalName,
      formatTripCode(trip.code),
      trip.origin,
      trip.destination,
      TITLE_KIND_LABEL[item.kind],
    ].join(' '),
  );
}

/** Filtro de busca da tela (a API de títulos não tem `q`): todas as palavras precisam aparecer. */
export function matchesSearch(item: TitleListItem, search: string): boolean {
  const words = normalize(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchableText(item);
  return words.every((word) => text.includes(word));
}
