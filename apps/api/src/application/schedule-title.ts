import { toBusinessDate, type LocalDate } from '../domain/shared/local-date.js';
import { assertCanSchedule } from '../domain/title/operations.js';
import { toDbDate } from '../infra/db-date.js';
import { lockTrip } from '../infra/trip-lock.js';
import type { UseCaseContext } from './context.js';
import { findTitleListViews, type TitleListView } from './title-view.js';
import { getTripIdOfTitle, loadTripState, titleNotFound } from './trip-state.js';

export interface ScheduleRequest {
  titleId: string;
  date: LocalDate;
  today: LocalDate;
  now: Date;
}

/**
 * Programa um título na sua própria transação (R10): trava a viagem, pede ao domínio a decisão e
 * grava SCHEDULED com `scheduledFor`. Lança o erro de domínio da recusa. É o passo comum da
 * programação individual e de cada item do lote (R11).
 */
export async function applySchedule(
  context: UseCaseContext,
  { titleId, date, today, now }: ScheduleRequest,
): Promise<void> {
  await context.prisma.$transaction(async (tx) => {
    const tripId = await getTripIdOfTitle(tx, titleId);
    await lockTrip(tx, tripId);
    const state = await loadTripState(tx, tripId);
    const title = state.trip.titles.find((candidate) => candidate.id === titleId);
    if (title === undefined) throw titleNotFound(titleId);

    assertCanSchedule({ title, facts: state.facts, date, today });

    await tx.title.update({
      where: { id: titleId },
      data: { status: 'SCHEDULED', scheduledFor: toDbDate(date), updatedAt: now },
    });
  });
}

/** Programa (ou reprograma) um título a pagar para a data; a recusa sai como erro de domínio. */
export async function scheduleTitle(
  context: UseCaseContext,
  titleId: string,
  input: { date: LocalDate },
): Promise<TitleListView> {
  const now = context.clock.now();
  const today = toBusinessDate(now, context.businessTz);

  await applySchedule(context, { titleId, date: input.date, today, now });

  const [view] = await findTitleListViews(context.prisma, { id: titleId }, today);
  if (view === undefined) throw titleNotFound(titleId);
  return view;
}
