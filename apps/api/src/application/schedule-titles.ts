import { DomainError } from '../domain/errors.js';
import {
  assertValidLocalDate,
  toBusinessDate,
  type LocalDate,
} from '../domain/shared/local-date.js';
import { assertCanSchedule } from '../domain/title/operations.js';
import { toDbDate } from '../infra/db-date.js';
import { lockTrip } from '../infra/trip-lock.js';
import type { UseCaseContext } from './context.js';
import { findTitleListViews, type TitleListView } from './title-view.js';
import { getTripIdOfTitle, loadTripState, titleNotFound } from './trip-state.js';

export interface ScheduleTitlesInput {
  titleIds: readonly string[];
  date: LocalDate;
}

export interface ScheduleRejection {
  titleId: string;
  code: string;
  message: string;
}

export interface ScheduleTitlesResult {
  scheduled: TitleListView[];
  rejected: ScheduleRejection[];
}

/**
 * R11 — Programa vários títulos para a mesma data. Cada título roda em transação própria, então
 * uma recusa (regra do R10, trava do R4, título inexistente) não desfaz os demais: a resposta
 * diz o que passou e por que o resto falhou.
 */
export async function scheduleTitles(
  context: UseCaseContext,
  input: ScheduleTitlesInput,
): Promise<ScheduleTitlesResult> {
  assertValidLocalDate(input.date);
  const now = context.clock.now();
  const today = toBusinessDate(now, context.businessTz);
  const titleIds = [...new Set(input.titleIds)];

  const scheduledIds: string[] = [];
  const rejected: ScheduleRejection[] = [];
  for (const titleId of titleIds) {
    try {
      await scheduleOne(context, { titleId, date: input.date, today, now });
      scheduledIds.push(titleId);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      rejected.push({ titleId, code: error.code, message: error.message });
    }
  }

  const views = await findTitleListViews(context.prisma, { id: { in: scheduledIds } }, today);
  const viewById = new Map(views.map((view) => [view.id, view]));
  return {
    scheduled: scheduledIds.flatMap((id) => viewById.get(id) ?? []),
    rejected,
  };
}

async function scheduleOne(
  context: UseCaseContext,
  { titleId, date, today, now }: { titleId: string; date: LocalDate; today: LocalDate; now: Date },
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
