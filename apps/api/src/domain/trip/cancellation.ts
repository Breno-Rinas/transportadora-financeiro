import { DomainError } from '../errors.js';
import { toBusinessDate } from '../shared/local-date.js';
import { isOpenTitle } from '../title/agenda.js';
import type { TitleKind, TitleStatus } from '../title/types.js';
import { assertEventCanBeRegistered } from './event-rules.js';
import type { TripFacts } from './facts.js';
import type { StatusChange } from './lifecycle.js';
import type { TitleDraft } from './title-generation.js';
import type { TripStatus } from './types.js';

export interface CancellationTitle {
  kind: TitleKind;
  status: TitleStatus;
  amountCents: number;
}

export interface CancellationRequest<T extends CancellationTitle> {
  trip: { status: TripStatus; facts: TripFacts };
  titles: readonly T[];
  /** Quando a viagem foi cancelada (o `occurredAt` do fato TRIP_CANCELLED). */
  cancelledAt: Date;
  now: Date;
  timeZone: string;
}

/** O que o caso de uso grava, na mesma transação do fato TRIP_CANCELLED. */
export interface CancellationPlan<T extends CancellationTitle> {
  titlesToCancel: T[];
  advanceRecovery: TitleDraft | null;
  statusChange: StatusChange;
}

/**
 * R13 — A viagem pode ser cancelada em qualquer status, menos finalizada (saldo pago) ou já
 * cancelada. O reenvio do mesmo cancelamento não chega aqui: é tratado antes, pelo R6.
 */
export function assertTripCanBeCancelled(status: TripStatus): void {
  if (status === 'BALANCE_PAID') {
    throw new DomainError(
      'TRIP_ALREADY_FINISHED',
      'Esta viagem já foi finalizada, com o saldo pago, e não pode ser cancelada.',
    );
  }
  if (status === 'CANCELLED') {
    throw new DomainError('TRIP_CANCELLED', 'Esta viagem já está cancelada.');
  }
}

/** R13 — Os títulos em aberto (OPEN ou SCHEDULED) são cancelados; os pagos ficam como histórico. */
export function selectTitlesToCancel<T extends { status: TitleStatus }>(titles: readonly T[]): T[] {
  return titles.filter((title) => isOpenTitle(title.status));
}

/**
 * R13 — Com o adiantamento já pago, nasce a recuperação: a receber do motorista, com o mesmo
 * valor e vencimento na data de negócio do cancelamento. Sem adiantamento pago, nada a recuperar.
 */
export function buildAdvanceRecovery(
  titles: readonly CancellationTitle[],
  cancelledAt: Date,
  timeZone: string,
): TitleDraft | null {
  const advance = titles.find((title) => title.kind === 'ADVANCE');
  if (advance?.status !== 'PAID') return null;
  return {
    nature: 'RECEIVABLE',
    kind: 'ADVANCE_RECOVERY',
    amountCents: advance.amountCents,
    dueDate: toBusinessDate(cancelledAt, timeZone),
    status: 'OPEN',
  };
}

/** R13 — CANCELLED é terminal e fora da sequência do R8: sai de qualquer status permitido. */
export function getCancellationStatusChange(status: TripStatus): StatusChange {
  return { from: status, to: 'CANCELLED', trigger: 'TRIP_CANCELLED' };
}

/**
 * R13 — Decide o cancelamento de uma viagem (depois de o R6 dizer que o fato é novo): confere o
 * status e a data (não pode estar no futuro nem antes do último fato registrado) e devolve os
 * títulos a cancelar, a recuperação do adiantamento (se houver) e a transição para CANCELLED.
 */
export function planTripCancellation<T extends CancellationTitle>(
  request: CancellationRequest<T>,
): CancellationPlan<T> {
  const { trip, titles, cancelledAt, now, timeZone } = request;
  assertTripCanBeCancelled(trip.status);
  assertEventCanBeRegistered({ type: 'TRIP_CANCELLED', occurredAt: cancelledAt }, trip, now);

  return {
    titlesToCancel: selectTitlesToCancel(titles),
    advanceRecovery: buildAdvanceRecovery(titles, cancelledAt, timeZone),
    statusChange: getCancellationStatusChange(trip.status),
  };
}
