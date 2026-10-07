import type { TitleKind, TitleNature } from '../../api/types';
import { formatTripCode } from '../../lib/format';
import { TITLE_KIND_LABEL } from '../../lib/labels';

/** O que os modais de Programar e Dar baixa precisam saber do título. */
export interface TitleTarget {
  id: string;
  nature: TitleNature;
  kind: TitleKind;
  amountCents: number;
  tripCode: number;
}

/** "Saldo · VG-0001": identifica o título no cabeçalho dos modais. */
export function describeTitle({ kind, tripCode }: Pick<TitleTarget, 'kind' | 'tripCode'>): string {
  return `${TITLE_KIND_LABEL[kind]} · ${formatTripCode(tripCode)}`;
}
