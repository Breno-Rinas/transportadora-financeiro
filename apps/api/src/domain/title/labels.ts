import type { TitleKind, TitleNature, TitleStatus } from './types.js';

// Nomes dos títulos em pt-BR, como o analista fala (glossário do CLAUDE.md). Usados nas saídas
// geradas pela API, como a exportação CSV; o front tem os seus em `lib/labels.ts`.

export const TITLE_NATURE_LABELS: Readonly<Record<TitleNature, string>> = {
  PAYABLE: 'A pagar',
  RECEIVABLE: 'A receber',
};

export const TITLE_KIND_LABELS: Readonly<Record<TitleKind, string>> = {
  ADVANCE: 'Adiantamento',
  BALANCE: 'Saldo',
  CLIENT_FREIGHT: 'Frete do cliente',
  ADVANCE_RECOVERY: 'Recuperação de adiantamento',
};

const TITLE_STATUS_LABELS: Readonly<Record<TitleStatus, string>> = {
  OPEN: 'Em aberto',
  SCHEDULED: 'Programado',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
};

/** Status do título; o a receber pago aparece como "Recebido". */
export function getTitleStatusLabel(status: TitleStatus, nature: TitleNature): string {
  return status === 'PAID' && nature === 'RECEIVABLE' ? 'Recebido' : TITLE_STATUS_LABELS[status];
}

export type TitleCounterparty = 'CLIENT' | 'DRIVER';

/**
 * Com quem o título é acertado. Não basta a natureza: a recuperação do adiantamento (R13) é a
 * receber, mas do motorista.
 */
export function getTitleCounterparty(kind: TitleKind): TitleCounterparty {
  return kind === 'CLIENT_FREIGHT' ? 'CLIENT' : 'DRIVER';
}
