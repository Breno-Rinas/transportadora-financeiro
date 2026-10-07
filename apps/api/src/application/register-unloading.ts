import { assertEventCanBeRegistered, decideEventRegistration } from '../domain/trip/event-rules.js';
import type { UseCaseContext } from './context.js';
import { registerTripEvent, type TripEventResult } from './trip-event.js';
import { getRegisteredFingerprint } from './trip-state.js';

/** Registra a descarga (fato UNLOADED). Exige a viagem carregada (R9). */
export async function registerUnloading(
  context: UseCaseContext,
  tripId: string,
  input: { occurredAt: Date },
): Promise<TripEventResult> {
  const { occurredAt } = input;

  return registerTripEvent(context, tripId, async (tx, state, now) => {
    const decision = decideEventRegistration(getRegisteredFingerprint(state, 'UNLOADED'), {
      type: 'UNLOADED',
      occurredAt,
    });
    if (decision === 'REPLAY') return decision;

    assertEventCanBeRegistered(
      { type: 'UNLOADED', occurredAt },
      { status: state.trip.status, facts: state.facts },
      now,
    );
    await tx.tripEvent.create({
      data: { tripId, type: 'UNLOADED', occurredAt, recordedAt: now },
    });
    return decision;
  });
}
