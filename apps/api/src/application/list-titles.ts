import { compareLocalDate, toBusinessDate, type LocalDate } from '../domain/shared/local-date.js';
import type { TitleKind, TitleNature, TitleStatus } from '../domain/title/types.js';
import type { UseCaseContext } from './context.js';
import { findTitleListViews, type TitleListView } from './title-view.js';

export interface ListTitlesFilters {
  nature?: TitleNature | undefined;
  kind?: TitleKind | undefined;
  status?: TitleStatus | undefined;
  /** Limites inclusivos da data efetiva (`scheduledFor ?? dueDate`). */
  dueFrom?: LocalDate | undefined;
  dueTo?: LocalDate | undefined;
  /** true: só títulos com algum motivo de trava; false: só os sem trava. */
  locked?: boolean | undefined;
  tripId?: string | undefined;
}

/**
 * Agenda de títulos, ordenada pela data efetiva (sem data por último). Os filtros simples vão
 * para o banco; data efetiva e travas vêm do domínio, então esses filtros rodam depois.
 */
export async function listTitles(
  context: UseCaseContext,
  filters: ListTitlesFilters,
): Promise<TitleListView[]> {
  const today = toBusinessDate(context.clock.now(), context.businessTz);
  const titles = await findTitleListViews(
    context.prisma,
    {
      nature: filters.nature,
      kind: filters.kind,
      status: filters.status,
      tripId: filters.tripId,
    },
    today,
  );

  return titles
    .filter((title) => isInEffectiveDateRange(title.effectiveDate, filters))
    .filter((title) => filters.locked === undefined || isLocked(title) === filters.locked)
    .sort(compareAgendaOrder);
}

/** Mesmo critério do indicador de saldos travados do painel: algum motivo de trava. */
function isLocked(title: TitleListView): boolean {
  return title.locks.reasons.length > 0;
}

function isInEffectiveDateRange(
  effectiveDate: LocalDate | null,
  { dueFrom, dueTo }: ListTitlesFilters,
): boolean {
  if (dueFrom === undefined && dueTo === undefined) return true;
  if (effectiveDate === null) return false;
  if (dueFrom !== undefined && compareLocalDate(effectiveDate, dueFrom) < 0) return false;
  return dueTo === undefined || compareLocalDate(effectiveDate, dueTo) <= 0;
}

/** Data efetiva ascendente, sem data por último; empate pela viagem e pela espécie. */
function compareAgendaOrder(a: TitleListView, b: TitleListView): number {
  if (a.effectiveDate !== b.effectiveDate) {
    if (a.effectiveDate === null) return 1;
    if (b.effectiveDate === null) return -1;
    return compareLocalDate(a.effectiveDate, b.effectiveDate);
  }
  return a.trip.code - b.trip.code || a.kind.localeCompare(b.kind);
}
