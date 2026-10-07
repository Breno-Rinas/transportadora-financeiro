import {
  buildDashboard,
  resolveDashboardPeriod,
  type Dashboard,
} from '../domain/dashboard/indicators.js';
import {
  addDays,
  startOfBusinessDay,
  toBusinessDate,
  type DateRange,
  type LocalDate,
} from '../domain/shared/local-date.js';
import { isOpenTitle } from '../domain/title/agenda.js';
import { buildTripFacts } from '../domain/trip/facts.js';
import { TitleStatus } from '../generated/prisma/client.js';
import { fromNullableDbDate } from '../infra/db-date.js';
import type { UseCaseContext } from './context.js';

export interface DashboardView extends Dashboard {
  today: LocalDate;
  period: DateRange;
}

// O domínio ignora os títulos fechados; filtrar no banco só evita carregá-los.
const OPEN_TITLE_STATUSES = Object.values(TitleStatus).filter(isOpenTitle);

/** Indicadores do painel; o período padrão (mês corrente) e os cálculos vêm do domínio. */
export async function getDashboard(
  context: UseCaseContext,
  requested: { from?: LocalDate | undefined; to?: LocalDate | undefined },
): Promise<DashboardView> {
  const { prisma, businessTz } = context;
  const today = toBusinessDate(context.clock.now(), businessTz);
  const period = resolveDashboardPeriod(today, requested);

  const titles = await prisma.title.findMany({
    where: { status: { in: OPEN_TITLE_STATUSES } },
    select: {
      nature: true,
      kind: true,
      status: true,
      amountCents: true,
      dueDate: true,
      scheduledFor: true,
      trip: {
        select: {
          events: { select: { type: true, occurredAt: true } },
          titles: { select: { kind: true, status: true } },
        },
      },
    },
  });

  // Viagens com CT-e emitido dentro do período; o domínio confere pela data de negócio.
  const trips = await prisma.trip.findMany({
    where: {
      cte: {
        issuedAt: {
          gte: startOfBusinessDay(period.from, businessTz),
          lt: startOfBusinessDay(addDays(period.to, 1), businessTz),
        },
      },
    },
    select: {
      cte: { select: { issuedAt: true } },
      titles: { select: { kind: true, status: true, amountCents: true } },
    },
  });

  const dashboard = buildDashboard({
    today,
    period,
    timeZone: businessTz,
    titles: titles.map(({ trip, dueDate, scheduledFor, ...title }) => ({
      ...title,
      dueDate: fromNullableDbDate(dueDate),
      scheduledFor: fromNullableDbDate(scheduledFor),
      tripFacts: buildTripFacts(trip.events, trip.titles),
    })),
    trips: trips.map(({ cte, titles: tripTitles }) => ({
      cteIssuedAt: cte?.issuedAt ?? null,
      titles: tripTitles,
    })),
  });

  return { today, period, ...dashboard };
}
