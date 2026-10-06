import { addDays, compareLocalDate, type LocalDate } from '../shared/local-date.js';
import type { TitleStatus } from './types.js';

/** Em aberto = ainda a pagar ou a receber, programado ou não. */
export function isOpenTitle(status: TitleStatus | null): boolean {
  return status === 'OPEN' || status === 'SCHEDULED';
}

/** R10 — A data efetiva da agenda e do painel: a programação, se houver, senão o vencimento. */
export function getEffectiveDate(title: {
  scheduledFor: LocalDate | null;
  dueDate: LocalDate | null;
}): LocalDate | null {
  return title.scheduledFor ?? title.dueDate;
}

/**
 * Faixa da data efetiva em relação a hoje. TODAY e WITHIN_WEEK juntos formam a janela de
 * 7 dias do painel (hoje até hoje + 6).
 */
export type DueBucket = 'OVERDUE' | 'TODAY' | 'WITHIN_WEEK' | 'LATER' | 'NO_DATE';

const WEEK_LENGTH_DAYS = 7;

export function classifyDueDate(effectiveDate: LocalDate | null, today: LocalDate): DueBucket {
  if (effectiveDate === null) return 'NO_DATE';

  const comparedToToday = compareLocalDate(effectiveDate, today);
  if (comparedToToday < 0) return 'OVERDUE';
  if (comparedToToday === 0) return 'TODAY';

  const lastDayOfWeek = addDays(today, WEEK_LENGTH_DAYS - 1);
  return compareLocalDate(effectiveDate, lastDayOfWeek) <= 0 ? 'WITHIN_WEEK' : 'LATER';
}
