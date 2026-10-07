import { assertEventCanBeRegistered, decideEventRegistration } from '../domain/trip/event-rules.js';
import { assertPositiveCents } from '../domain/shared/money.js';
import { cteNumberInUse } from './conflicts.js';
import type { UseCaseContext } from './context.js';
import { registerTripEvent, type TripEventResult } from './trip-event.js';
import { getRegisteredFingerprint } from './trip-state.js';

export interface RegisterCteInput {
  number: number;
  series: number;
  issuedAt: Date;
  clientFreightCents: number;
}

/** Registra o CT-e (fato CTE_ISSUED, que ocorre na emissão). Com a foto, gera os títulos (R1). */
export async function registerCte(
  context: UseCaseContext,
  tripId: string,
  input: RegisterCteInput,
): Promise<TripEventResult> {
  assertPositiveCents(input.clientFreightCents, 'Frete do cliente');
  const { number, series, issuedAt, clientFreightCents } = input;

  return registerTripEvent(context, tripId, async (tx, state, now) => {
    const decision = decideEventRegistration(getRegisteredFingerprint(state, 'CTE_ISSUED'), {
      type: 'CTE_ISSUED',
      number,
      series,
      issuedAt,
      clientFreightCents,
    });
    if (decision === 'REPLAY') return decision;

    assertEventCanBeRegistered(
      { type: 'CTE_ISSUED', occurredAt: issuedAt },
      { status: state.trip.status, facts: state.facts },
      now,
    );
    const numberInUse = await tx.cte.findUnique({
      where: { series_number: { series, number } },
      select: { id: true },
    });
    if (numberInUse !== null) throw cteNumberInUse();

    const cte = await tx.cte.create({
      data: { tripId, number, series, issuedAt, clientFreightCents, createdAt: now },
    });
    await tx.tripEvent.create({
      data: { tripId, type: 'CTE_ISSUED', occurredAt: issuedAt, recordedAt: now, cteId: cte.id },
    });
    return decision;
  });
}
