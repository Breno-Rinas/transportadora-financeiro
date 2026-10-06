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
}

export interface FreightTotals {
  clientFreightCents: number;
  driverFreightCents: number;
}

/** Soma dos títulos por lado (cliente x motorista), ignorando os cancelados. */
export function sumTitleFreights(titles: readonly MarginTitle[]): FreightTotals {
  const totals: FreightTotals = { clientFreightCents: 0, driverFreightCents: 0 };
  for (const title of titles) {
    if (title.status === 'CANCELLED') continue;
    if (title.kind === 'CLIENT_FREIGHT') totals.clientFreightCents += title.amountCents;
    else totals.driverFreightCents += title.amountCents;
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
 * Com títulos: realizada = CLIENT_FREIGHT − (ADVANCE + BALANCE), ignorando cancelados.
 * Sem títulos, com frete cotado: projetada = frete cotado − frete do motorista.
 * Caso contrário: null.
 */
export function calculateTripMargin(input: TripMarginInput): Margin | null {
  if (input.titles.length > 0) {
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
