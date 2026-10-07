import type { TitleKind, TitleStatus } from '../title/types.js';

export type MarginKind = 'REALIZED' | 'PROJECTED';

export interface Margin {
  kind: MarginKind;
  amountCents: number;
  /** Margem sobre o frete do cliente, em % com 2 casas; só para exibição, não é dinheiro. */
  percent: number | null;
  isNegative: boolean;
}

export interface MarginTitle {
  kind: TitleKind;
  status: TitleStatus;
  amountCents: number;
}

export interface TripMarginInput {
  titles: readonly MarginTitle[];
  quotedClientFreightCents: number | null;
  driverFreightCents: number;
  /** Viagem cancelada (R13): a margem nunca é projetada. */
  cancelled: boolean;
}

export interface FreightTotals {
  clientFreightCents: number;
  driverFreightCents: number;
}

/**
 * Soma dos títulos por lado (cliente x motorista), ignorando os cancelados. A recuperação do
 * adiantamento (R13) devolve ao caixa o que foi pago ao motorista, então abate o custo dele.
 */
export function sumTitleFreights(titles: readonly MarginTitle[]): FreightTotals {
  const totals: FreightTotals = { clientFreightCents: 0, driverFreightCents: 0 };
  for (const title of titles) {
    if (title.status === 'CANCELLED') continue;
    switch (title.kind) {
      case 'CLIENT_FREIGHT':
        totals.clientFreightCents += title.amountCents;
        break;
      case 'ADVANCE':
      case 'BALANCE':
        totals.driverFreightCents += title.amountCents;
        break;
      case 'ADVANCE_RECOVERY':
        totals.driverFreightCents -= title.amountCents;
        break;
    }
  }
  return totals;
}

/**
 * Percentual de `partCents` sobre `wholeCents`, com 2 casas. O arredondamento é feito em
 * pontos-base inteiros, half-up simétrico (-12,345% vira -12,35%). Sem base positiva não há
 * percentual: devolve null em vez de dividir por zero.
 */
export function percentOf(partCents: number, wholeCents: number): number | null {
  if (wholeCents <= 0) return null;
  const basisPoints = Math.round((Math.abs(partCents) * 10_000) / wholeCents);
  if (basisPoints === 0) return 0;
  return (partCents < 0 ? -basisPoints : basisPoints) / 100;
}

function buildMargin(kind: MarginKind, totals: FreightTotals): Margin {
  const amountCents = totals.clientFreightCents - totals.driverFreightCents;
  return {
    kind,
    amountCents,
    percent: percentOf(amountCents, totals.clientFreightCents),
    isNegative: amountCents < 0,
  };
}

/**
 * R7 — Margem da viagem, sempre calculada no backend.
 * Com títulos: realizada = CLIENT_FREIGHT − (ADVANCE + BALANCE − ADVANCE_RECOVERY), ignorando
 * cancelados.
 * Sem títulos, com frete cotado: projetada = frete cotado − frete do motorista.
 * Caso contrário: null.
 * Viagem cancelada (R13): sempre a realizada, porque o frete cotado não vai mais acontecer. Sem
 * nada pago, ou com o adiantamento pago e recuperado, ela fica zerada.
 */
export function calculateTripMargin(input: TripMarginInput): Margin | null {
  if (input.titles.length > 0 || input.cancelled) {
    return buildMargin('REALIZED', sumTitleFreights(input.titles));
  }
  if (input.quotedClientFreightCents !== null) {
    return buildMargin('PROJECTED', {
      clientFreightCents: input.quotedClientFreightCents,
      driverFreightCents: input.driverFreightCents,
    });
  }
  return null;
}
