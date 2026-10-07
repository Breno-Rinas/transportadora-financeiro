import { buildTripFacts } from '../domain/trip/facts.js';
import { advanceLifecycle } from '../domain/trip/lifecycle.js';
import { buildLoadingTitles, shouldGenerateTitles } from '../domain/trip/title-generation.js';
import { toNullableDbDate } from '../infra/db-date.js';
import type { PrismaTx } from '../infra/prisma.js';
import { loadTripState } from './trip-state.js';

/**
 * Efeitos de um fato ou pagamento recém-gravado, na mesma transação: gera os três títulos do
 * carregamento quando o domínio diz que é a hora (R1) e avança o ciclo de vida (R8), gravando
 * cada transição em `TripStatusChange`. Relê a viagem para decidir sobre o estado já gravado.
 */
export async function applyTripProgress(
  tx: PrismaTx,
  tripId: string,
  options: { now: Date; businessTz: string },
): Promise<void> {
  const { now, businessTz } = options;
  const { trip, agreement, facts: recordedFacts } = await loadTripState(tx, tripId);
  let facts = recordedFacts;

  if (shouldGenerateTitles(facts)) {
    if (trip.cte === null) throw new Error(`Viagem ${tripId} carregada sem CT-e.`);
    const drafts = buildLoadingTitles({
      facts,
      cte: trip.cte,
      clientPaymentTermDays: trip.client.paymentTermDays,
      agreement,
      timeZone: businessTz,
    });
    await tx.title.createMany({
      data: drafts.map((draft) => ({
        tripId,
        nature: draft.nature,
        kind: draft.kind,
        amountCents: draft.amountCents,
        dueDate: toNullableDbDate(draft.dueDate),
        status: draft.status,
        createdAt: now,
        updatedAt: now,
      })),
    });
    facts = buildTripFacts(trip.events, drafts);
  }

  const lifecycle = advanceLifecycle(trip.status, facts);
  if (lifecycle.changes.length === 0) return;

  await tx.tripStatusChange.createMany({
    data: lifecycle.changes.map((change) => ({
      tripId,
      fromStatus: change.from,
      toStatus: change.to,
      trigger: change.trigger,
      changedAt: now,
    })),
  });
  await tx.trip.update({
    where: { id: tripId },
    data: { status: lifecycle.status, updatedAt: now },
  });
}
