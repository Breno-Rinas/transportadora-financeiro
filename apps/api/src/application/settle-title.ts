import { toBusinessDate, type LocalDate } from '../domain/shared/local-date.js';
import { assertCanSettle } from '../domain/title/operations.js';
import { toDbDate } from '../infra/db-date.js';
import { lockTrip } from '../infra/trip-lock.js';
import type { UseCaseContext } from './context.js';
import { findTitleListViews, type TitleListView } from './title-view.js';
import { applyTripProgress } from './trip-progress.js';
import { getTripIdOfTitle, loadTripState, titleNotFound } from './trip-state.js';

export interface SettleTitleInput {
  paidOn: LocalDate;
  amountCents: number;
  note?: string | null | undefined;
}

/**
 * Dá baixa integral no título (R10/R5): cria o pagamento, marca PAID e avança o ciclo de vida da
 * viagem (R8) na mesma transação.
 */
export async function settleTitle(
  context: UseCaseContext,
  titleId: string,
  input: SettleTitleInput,
): Promise<TitleListView> {
  const now = context.clock.now();
  const today = toBusinessDate(now, context.businessTz);

  await context.prisma.$transaction(async (tx) => {
    const tripId = await getTripIdOfTitle(tx, titleId);
    await lockTrip(tx, tripId);
    const state = await loadTripState(tx, tripId);
    const title = state.trip.titles.find((candidate) => candidate.id === titleId);
    if (title === undefined) throw titleNotFound(titleId);

    assertCanSettle({
      title,
      facts: state.facts,
      paidOn: input.paidOn,
      amountCents: input.amountCents,
      today,
    });

    await tx.payment.create({
      data: {
        titleId,
        paidOn: toDbDate(input.paidOn),
        amountCents: input.amountCents,
        note: input.note ?? null,
        createdAt: now,
      },
    });
    await tx.title.update({ where: { id: titleId }, data: { status: 'PAID', updatedAt: now } });
    await applyTripProgress(tx, tripId, { now, businessTz: context.businessTz });
  });

  const [view] = await findTitleListViews(context.prisma, { id: titleId }, today);
  if (view === undefined) throw titleNotFound(titleId);
  return view;
}
