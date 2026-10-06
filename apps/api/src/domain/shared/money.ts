import { DomainError } from '../errors.js';

/** Percentuais de adiantamento aceitos no acordo de frete com o motorista. */
export type AdvancePercent = 50 | 70;

export interface DriverFreightSplit {
  advanceCents: number;
  balanceCents: number;
}

export function isAdvancePercent(value: number): value is AdvancePercent {
  return value === 50 || value === 70;
}

/**
 * Garante um valor monetário em centavos inteiros e maior que zero.
 * `label` nomeia o valor na mensagem para o analista (ex.: "Frete do motorista").
 */
export function assertPositiveCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError('VALIDATION_ERROR', `${label}: informe um valor maior que zero.`, {
      value,
    });
  }
}

/**
 * R2 — Divide o frete do motorista em adiantamento e saldo.
 * O adiantamento usa arredondamento half-up em aritmética inteira (nunca float); o saldo é a
 * diferença, então absorve o arredondamento e `advanceCents + balanceCents === totalCents`.
 */
export function splitDriverFreight(totalCents: number, advancePercent: number): DriverFreightSplit {
  assertPositiveCents(totalCents, 'Frete do motorista');
  if (!isAdvancePercent(advancePercent)) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'O adiantamento deve ser de 50% ou 70% do frete do motorista.',
      { advancePercent },
    );
  }

  const advanceCents = Math.floor((totalCents * advancePercent + 50) / 100);
  return { advanceCents, balanceCents: totalCents - advanceCents };
}

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como moeda brasileira, para mensagens de erro ao analista. */
export function formatBRL(cents: number): string {
  return brlFormatter.format(cents / 100);
}
