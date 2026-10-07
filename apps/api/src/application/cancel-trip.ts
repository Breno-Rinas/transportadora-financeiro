import { planTripCancellation } from '../domain/trip/cancellation.js';
import { decideEventRegistration } from '../domain/trip/event-rules.js';
import { toNullableDbDate } from '../infra/db-date.js';
import type { UseCaseContext } from './context.js';
import { registerTripEvent, type TripEventResult } from './trip-event.js';
import { getRegisteredFingerprint } from './trip-state.js';

export interface CancelTripInput {
  reason: string;
  /** Quando a viagem foi cancelada; sem valor, vale o momento do envio. */
  occurredAt?: Date | undefined;
}

/**
 * R13 — Cancela a viagem numa única transação: grava o fato TRIP_CANCELLED com o motivo, cancela
 * os títulos em aberto, gera a recuperação do adiantamento já pago e leva a viagem a CANCELLED.
 * O reenvio com o mesmo motivo é idempotente (R6).
 */
export async function cancelTrip(
  context: UseCaseContext,
  tripId: string,
  input: CancelTripInput,
): Promise<TripEventResult> {
  const reason = input.reason.trim();

  return registerTripEvent(context, tripId, async (tx, state, now) => {
    const decision = decideEventRegistration(getRegisteredFingerprint(state, 'TRIP_CANCELLED'), {
      type: 'TRIP_CANCELLED',
      reason,
    });
    if (decision === 'REPLAY') return decision;

    const { trip } = state;
    const occurredAt = input.occurredAt ?? now;
    const plan = planTripCancellation({
      trip: { status: trip.status, facts: state.facts },
      titles: trip.titles,
      cancelledAt: occurredAt,
      now,
      timeZone: context.businessTz,
    });

    await tx.tripEvent.create({
      data: { tripId, type: 'TRIP_CANCELLED', occurredAt, recordedAt: now, note: reason },
    });
    await tx.title.updateMany({
      where: { id: { in: plan.titlesToCancel.map((title) => title.id) } },
      data: { status: 'CANCELLED', updatedAt: now },
    });
    if (plan.advanceRecovery !== null) {
      const recovery = plan.advanceRecovery;
      await tx.title.create({
        data: {
          tripId,
          nature: recovery.nature,
          kind: recovery.kind,
          amountCents: recovery.amountCents,
          dueDate: toNullableDbDate(recovery.dueDate),
          status: recovery.status,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    const { statusChange } = plan;
    await tx.tripStatusChange.create({
      data: {
        tripId,
        fromStatus: statusChange.from,
        toStatus: statusChange.to,
        trigger: statusChange.trigger,
        changedAt: now,
      },
    });
    await tx.trip.update({
      where: { id: tripId },
      data: { status: statusChange.to, updatedAt: now },
    });
    return decision;
  });
}
