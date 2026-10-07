import type { EventRegistration } from '../domain/trip/event-rules.js';
import type { PrismaTx } from '../infra/prisma.js';
import { lockTrip } from '../infra/trip-lock.js';
import { withUniqueViolationsAsDomainErrors } from './conflicts.js';
import type { UseCaseContext } from './context.js';
import { getTripDetail, type TripDetail } from './get-trip-detail.js';
import { applyTripProgress } from './trip-progress.js';
import { loadTripState, type TripState } from './trip-state.js';

export interface TripEventResult {
  /** true quando foi um reenvio idêntico (R6): nada foi gravado. */
  replayed: boolean;
  detail: TripDetail;
}

/**
 * Esqueleto comum dos eventos da viagem: transação, trava da viagem e estado atual. O `handler`
 * pede ao domínio a decisão (NEW ou REPLAY, ou lança o erro) e, se NEW, grava o fato; em seguida
 * vêm os títulos e as transições (R1/R8). Um REPLAY não grava nada. Devolve o detalhe atualizado.
 */
export async function registerTripEvent(
  context: UseCaseContext,
  tripId: string,
  handler: (tx: PrismaTx, state: TripState, now: Date) => Promise<EventRegistration>,
): Promise<TripEventResult> {
  const now = context.clock.now();

  const registration = await withUniqueViolationsAsDomainErrors(() =>
    context.prisma.$transaction(async (tx) => {
      await lockTrip(tx, tripId);
      const state = await loadTripState(tx, tripId);
      const decision = await handler(tx, state, now);
      if (decision === 'NEW') {
        await applyTripProgress(tx, tripId, { now, businessTz: context.businessTz });
      }
      return decision;
    }),
  );

  return { replayed: registration === 'REPLAY', detail: await getTripDetail(context, tripId) };
}
