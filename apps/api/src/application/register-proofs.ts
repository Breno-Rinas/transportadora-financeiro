import { assertEventCanBeRegistered, decideEventRegistration } from '../domain/trip/event-rules.js';
import { getBalanceDueDate } from '../domain/trip/title-generation.js';
import { toDbDate } from '../infra/db-date.js';
import type { UseCaseContext } from './context.js';
import { registerTripEvent, type TripEventResult } from './trip-event.js';
import { getRegisteredFingerprint } from './trip-state.js';

export interface RegisterProofsInput {
  occurredAt: Date;
  note?: string | null | undefined;
}

/**
 * Registra a chegada do canhoto original (fato PROOFS_RECEIVED). Exige a descarga (R9) e dá ao
 * saldo o vencimento na data de negócio da chegada (R3).
 */
export async function registerProofs(
  context: UseCaseContext,
  tripId: string,
  input: RegisterProofsInput,
): Promise<TripEventResult> {
  const { occurredAt } = input;

  return registerTripEvent(context, tripId, async (tx, state, now) => {
    const decision = decideEventRegistration(getRegisteredFingerprint(state, 'PROOFS_RECEIVED'), {
      type: 'PROOFS_RECEIVED',
      occurredAt,
    });
    if (decision === 'REPLAY') return decision;

    assertEventCanBeRegistered(
      { type: 'PROOFS_RECEIVED', occurredAt },
      { status: state.trip.status, facts: state.facts },
      now,
    );
    await tx.tripEvent.create({
      data: {
        tripId,
        type: 'PROOFS_RECEIVED',
        occurredAt,
        recordedAt: now,
        note: input.note ?? null,
      },
    });
    await tx.title.updateMany({
      where: { tripId, kind: 'BALANCE' },
      data: {
        dueDate: toDbDate(getBalanceDueDate(occurredAt, context.businessTz)),
        updatedAt: now,
      },
    });
    return decision;
  });
}
