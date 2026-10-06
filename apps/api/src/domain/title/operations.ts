import { DomainError } from '../errors.js';
import { assertValidLocalDate, compareLocalDate, type LocalDate } from '../shared/local-date.js';
import { formatBRL } from '../shared/money.js';
import type { TripFacts } from '../trip/facts.js';
import { getTitleLocks, type LockReason } from './locks.js';
import type { TitleKind, TitleNature, TitleStatus } from './types.js';

export interface OperableTitle {
  nature: TitleNature;
  kind: TitleKind;
  status: TitleStatus;
  amountCents: number;
}

export interface ScheduleRequest {
  title: OperableTitle;
  facts: TripFacts;
  date: LocalDate;
  today: LocalDate;
}

export interface SettleRequest {
  title: OperableTitle;
  facts: TripFacts;
  paidOn: LocalDate;
  amountCents: number;
  today: LocalDate;
}

/** Só títulos em aberto (OPEN ou SCHEDULED) podem ser programados ou baixados. */
function assertTitleIsOpen(status: TitleStatus): void {
  if (status === 'PAID') {
    throw new DomainError('TITLE_ALREADY_PAID', 'Este título já está pago.');
  }
  if (status === 'CANCELLED') {
    throw new DomainError('TITLE_CANCELLED', 'Este título está cancelado.');
  }
}

function describeReasons(reasons: readonly LockReason[]): string {
  return reasons.map((reason) => `${reason.message}.`).join(' ');
}

function balanceLockedError(reasons: readonly LockReason[]): DomainError {
  return new DomainError('BALANCE_LOCKED', `O saldo está travado. ${describeReasons(reasons)}`, {
    reasons,
  });
}

/**
 * R10 — Programar pagamento: só títulos a pagar, em aberto (reprogramar é permitido), sem
 * trava de programação e para hoje ou depois. O caso de uso então grava SCHEDULED e
 * `scheduledFor = date`.
 */
export function assertCanSchedule({ title, facts, date, today }: ScheduleRequest): void {
  if (title.nature !== 'PAYABLE') {
    throw new DomainError(
      'ONLY_PAYABLE_CAN_BE_SCHEDULED',
      'Só títulos a pagar podem ser programados.',
    );
  }
  assertTitleIsOpen(title.status);

  const locks = getTitleLocks(title, facts);
  if (!locks.canSchedule) throw balanceLockedError(locks.reasons);

  assertValidLocalDate(date);
  if (compareLocalDate(date, today) < 0) {
    throw new DomainError('INVALID_DATE', 'A data da programação não pode ser anterior a hoje.', {
      date,
      today,
    });
  }
}

/**
 * R10/R5 — Dar baixa: título em aberto, sem trava, valor integral e pagamento até hoje.
 * O caso de uso então cria o Payment, grava PAID e roda o ciclo de vida (R8).
 */
export function assertCanSettle({ title, facts, paidOn, amountCents, today }: SettleRequest): void {
  assertTitleIsOpen(title.status);

  const locks = getTitleLocks(title, facts);
  if (!locks.canSettle) {
    // Com a programação liberada, a única trava que sobra é a ordem de pagamento (R5).
    throw locks.canSchedule
      ? new DomainError('ADVANCE_NOT_PAID', describeReasons(locks.reasons), {
          reasons: locks.reasons,
        })
      : balanceLockedError(locks.reasons);
  }

  if (amountCents !== title.amountCents) {
    throw new DomainError(
      'PARTIAL_PAYMENT_NOT_SUPPORTED',
      `A baixa deve ser integral: informe o valor total do título, ${formatBRL(title.amountCents)}.`,
      { expectedCents: title.amountCents, amountCents },
    );
  }

  assertValidLocalDate(paidOn);
  if (compareLocalDate(paidOn, today) > 0) {
    throw new DomainError('INVALID_DATE', 'A data do pagamento não pode ser futura.', {
      paidOn,
      today,
    });
  }
}
