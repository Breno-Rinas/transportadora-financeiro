import { DomainError } from '../domain/errors.js';
import { buildTripFacts, type TripFacts } from '../domain/trip/facts.js';
import type { EventFingerprint } from '../domain/trip/event-rules.js';
import type { TripEventType } from '../domain/trip/types.js';
import type { FreightAgreement, Prisma } from '../generated/prisma/client.js';
import type { PrismaTx } from '../infra/prisma.js';

// Formato do estado carregado; `loadTripState` busca cada relação numa consulta própria.
const tripStateInclude = {
  client: { select: { paymentTermDays: true } },
  agreement: true,
  cte: true,
  events: { include: { attachment: { select: { sha256: true } } } },
  titles: true,
} satisfies Prisma.TripInclude;

type TripStateRecord = Prisma.TripGetPayload<{ include: typeof tripStateInclude }>;

/** O que os casos de uso de mutação precisam da viagem para chamar o domínio. */
export interface TripState {
  trip: TripStateRecord;
  agreement: FreightAgreement;
  facts: TripFacts;
}

export function tripNotFound(tripId: string): DomainError {
  return new DomainError('NOT_FOUND', 'Viagem não encontrada.', { tripId });
}

export function titleNotFound(titleId: string): DomainError {
  return new DomainError('NOT_FOUND', 'Título não encontrado.', { titleId });
}

/** A viagem do título. O título nunca muda de viagem: descobri-la antes de travá-la é seguro. */
export async function getTripIdOfTitle(tx: PrismaTx, titleId: string): Promise<string> {
  const title = await tx.title.findUnique({ where: { id: titleId }, select: { tripId: true } });
  if (title === null) throw titleNotFound(titleId);
  return title.tripId;
}

/**
 * Carrega a viagem com eventos, CT-e e títulos. Chamar depois de `lockTrip`.
 *
 * Uma consulta por vez: um `include` com várias relações faz o Prisma buscá-las em paralelo, e
 * dentro da transação todas disputariam a mesma conexão (o pg 8 avisa e o pg 9 vai recusar).
 */
export async function loadTripState(tx: PrismaTx, tripId: string): Promise<TripState> {
  const trip = await tx.trip.findUnique({ where: { id: tripId } });
  if (trip === null) throw tripNotFound(tripId);
  const client = await tx.client.findUniqueOrThrow({
    where: { id: trip.clientId },
    select: tripStateInclude.client.select,
  });
  const agreement = await tx.freightAgreement.findUnique({ where: { tripId } });
  if (agreement === null) {
    throw new Error(`Viagem ${tripId} sem acordo de frete: o cadastro sempre cria os dois juntos.`);
  }
  const cte = await tx.cte.findUnique({ where: { tripId } });
  const events = await tx.tripEvent.findMany({
    where: { tripId },
    include: tripStateInclude.events.include,
  });
  const titles = await tx.title.findMany({ where: { tripId } });

  const record: TripStateRecord = { ...trip, client, agreement, cte, events, titles };
  return { trip: record, agreement, facts: buildTripFacts(events, titles) };
}

/**
 * Os dados do evento já registrado do tipo (null se ainda não houver), na forma que o R6 compara
 * com o reenvio: CT-e pelos seus dados, foto pelo sha256 do arquivo, cancelamento pelo motivo
 * (gravado em `note`), demais pela data.
 */
export function getRegisteredFingerprint(
  { trip }: TripState,
  type: TripEventType,
): EventFingerprint | null {
  const event = trip.events.find((candidate) => candidate.type === type);
  if (event === undefined) return null;

  switch (type) {
    case 'CTE_ISSUED': {
      if (trip.cte === null) throw new Error(`Evento CTE_ISSUED sem CT-e na viagem ${trip.id}.`);
      const { number, series, issuedAt, clientFreightCents } = trip.cte;
      return { type, number, series, issuedAt, clientFreightCents };
    }
    case 'LOADING_PHOTO_ATTACHED': {
      if (event.attachment === null) {
        throw new Error(`Evento LOADING_PHOTO_ATTACHED sem arquivo na viagem ${trip.id}.`);
      }
      return { type, sha256: event.attachment.sha256 };
    }
    case 'UNLOADED':
    case 'PROOFS_RECEIVED':
      return { type, occurredAt: event.occurredAt };
    case 'TRIP_CANCELLED':
      return { type, reason: event.note ?? '' };
  }
}
