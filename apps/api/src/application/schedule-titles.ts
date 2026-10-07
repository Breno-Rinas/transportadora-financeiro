import { DomainError } from '../domain/errors.js';
import {
  assertValidLocalDate,
  toBusinessDate,
  type LocalDate,
} from '../domain/shared/local-date.js';
import type { UseCaseContext } from './context.js';
import { applySchedule } from './schedule-title.js';
import { findTitleListViews, type TitleListView } from './title-view.js';

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
 * R11 — Programa vários títulos para a mesma data. Cada título roda em transação própria (o mesmo
 * passo da programação individual), então uma recusa (regra do R10, trava do R4, título
 * inexistente) não desfaz os demais: a resposta diz o que passou e por que o resto falhou.
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
      await applySchedule(context, { titleId, date: input.date, today, now });
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
