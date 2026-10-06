import { DomainError } from '../errors.js';
import {
  assertValidLocalDate,
  compareLocalDate,
  getMonthRange,
  isWithinRange,
  toBusinessDate,
  type DateRange,
  type LocalDate,
} from '../shared/local-date.js';
import { classifyDueDate, getEffectiveDate, isOpenTitle, type DueBucket } from '../title/agenda.js';
import { getTitleLocks } from '../title/locks.js';
import type { TitleKind, TitleNature, TitleStatus } from '../title/types.js';
import type { TripFacts } from '../trip/facts.js';
import { percentOf, sumTitleFreights, type MarginTitle } from '../trip/margin.js';

export interface TitleTotals {
  count: number;
  totalCents: number;
}

export interface Dashboard {
  payableOverdue: TitleTotals;
  payableDueToday: TitleTotals;
  payableDueWeek: TitleTotals;
  receivableOpen: TitleTotals & { overdueCount: number };
  lockedBalances: TitleTotals;
  margin: { amountCents: number; percent: number | null };
}

export interface DashboardTitle {
  nature: TitleNature;
  kind: TitleKind;
  status: TitleStatus;
  amountCents: number;
  dueDate: LocalDate | null;
  scheduledFor: LocalDate | null;
  /** Fatos da viagem do título, usados nas travas do saldo. */
  tripFacts: TripFacts;
}

export interface DashboardTrip {
  cteIssuedAt: Date | null;
  titles: readonly MarginTitle[];
}

export interface DashboardInput {
  today: LocalDate;
  period: DateRange;
  timeZone: string;
  /** Títulos já carregados; os que não estão em aberto são ignorados. */
  titles: readonly DashboardTitle[];
  /** Viagens já carregadas; a margem considera só as com CT-e emitido no período. */
  trips: readonly DashboardTrip[];
}

/** Período do painel: cada limite não informado cai no mês corrente. */
export function resolveDashboardPeriod(
  today: LocalDate,
  requested: { from?: LocalDate | undefined; to?: LocalDate | undefined },
): DateRange {
  const currentMonth = getMonthRange(today);
  const period = { from: requested.from ?? currentMonth.from, to: requested.to ?? currentMonth.to };

  assertValidLocalDate(period.from);
  assertValidLocalDate(period.to);
  if (compareLocalDate(period.from, period.to) > 0) {
    throw new DomainError(
      'INVALID_DATE',
      'A data inicial do período não pode ser posterior à data final.',
      period,
    );
  }
  return period;
}

function totalsOf(titles: readonly DashboardTitle[]): TitleTotals {
  return {
    count: titles.length,
    totalCents: titles.reduce((sum, title) => sum + title.amountCents, 0),
  };
}

/**
 * Margem realizada somada das viagens com CT-e emitido no período (data de negócio). O
 * percentual é ponderado: margem total sobre o frete total dos clientes, não a média dos
 * percentuais. Viagens sem títulos ainda não têm margem realizada e ficam de fora.
 */
function sumPeriodMargin(
  trips: readonly DashboardTrip[],
  period: DateRange,
  timeZone: string,
): Dashboard['margin'] {
  let clientFreightCents = 0;
  let driverFreightCents = 0;

  for (const { cteIssuedAt, titles } of trips) {
    if (cteIssuedAt === null || titles.length === 0) continue;
    if (!isWithinRange(toBusinessDate(cteIssuedAt, timeZone), period)) continue;

    const freights = sumTitleFreights(titles);
    clientFreightCents += freights.clientFreightCents;
    driverFreightCents += freights.driverFreightCents;
  }

  const amountCents = clientFreightCents - driverFreightCents;
  return { amountCents, percent: percentOf(amountCents, clientFreightCents) };
}

/**
 * Indicadores do painel a partir de listas já carregadas. "Em aberto" é OPEN ou SCHEDULED e
 * os prazos usam a data efetiva (programação ?? vencimento) comparada com hoje.
 */
export function buildDashboard({
  today,
  period,
  timeZone,
  titles,
  trips,
}: DashboardInput): Dashboard {
  const openTitles = titles.filter((title) => isOpenTitle(title.status));
  const payables = openTitles.filter((title) => title.nature === 'PAYABLE');
  const receivables = openTitles.filter((title) => title.nature === 'RECEIVABLE');

  const isInBuckets =
    (...buckets: DueBucket[]) =>
    (title: DashboardTitle): boolean =>
      buckets.includes(classifyDueDate(getEffectiveDate(title), today));

  return {
    payableOverdue: totalsOf(payables.filter(isInBuckets('OVERDUE'))),
    payableDueToday: totalsOf(payables.filter(isInBuckets('TODAY'))),
    payableDueWeek: totalsOf(payables.filter(isInBuckets('TODAY', 'WITHIN_WEEK'))),
    receivableOpen: {
      ...totalsOf(receivables),
      overdueCount: receivables.filter(isInBuckets('OVERDUE')).length,
    },
    lockedBalances: totalsOf(
      openTitles.filter(
        (title) =>
          title.kind === 'BALANCE' && getTitleLocks(title, title.tripFacts).reasons.length > 0,
      ),
    ),
    margin: sumPeriodMargin(trips, period, timeZone),
  };
}
