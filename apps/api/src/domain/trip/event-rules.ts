import { DomainError } from '../errors.js';
import { getLoadedAt, type TripFacts } from './facts.js';
import type { TripEventType, TripStatus } from './types.js';

/** Os dados que o R6 compara para distinguir um reenvio de um evento divergente. */
export type EventFingerprint =
  | {
      type: 'CTE_ISSUED';
      number: number;
      series: number;
      issuedAt: Date;
      clientFreightCents: number;
    }
  | { type: 'LOADING_PHOTO_ATTACHED'; sha256: string }
  | { type: 'UNLOADED'; occurredAt: Date }
  | { type: 'PROOFS_RECEIVED'; occurredAt: Date }
  | { type: 'TRIP_CANCELLED'; reason: string };

/** NEW: registrar e processar. REPLAY: reenvio idêntico, devolver o estado atual sem reprocessar. */
export type EventRegistration = 'NEW' | 'REPLAY';

const ALREADY_REGISTERED_MESSAGES: Record<TripEventType, string> = {
  CTE_ISSUED: 'Esta viagem já tem um CT-e registrado com outros dados.',
  LOADING_PHOTO_ATTACHED: 'Esta viagem já tem outra foto do carregamento registrada.',
  UNLOADED: 'A descarga desta viagem já foi registrada com outra data.',
  PROOFS_RECEIVED: 'A chegada dos comprovantes desta viagem já foi registrada com outra data.',
  TRIP_CANCELLED: 'Esta viagem já foi cancelada com outro motivo.',
};

/**
 * Chave de comparação do R6: CT-e pelos seus dados, foto pelo arquivo, cancelamento pelo motivo
 * (a data é opcional e, omitida, vale o momento do envio), demais pela data.
 */
function comparisonKey(event: EventFingerprint): string {
  switch (event.type) {
    case 'CTE_ISSUED':
      return [
        event.number,
        event.series,
        event.issuedAt.toISOString(),
        event.clientFreightCents,
      ].join('|');
    case 'LOADING_PHOTO_ATTACHED':
      return event.sha256;
    case 'UNLOADED':
    case 'PROOFS_RECEIVED':
      return event.occurredAt.toISOString();
    case 'TRIP_CANCELLED':
      return event.reason.trim();
  }
}

/**
 * R6 — Decide o que fazer com um evento diante do já registrado do mesmo tipo na viagem
 * (`existing`, null se ainda não houver). Mesmos dados: REPLAY. Dados diferentes:
 * EVENT_ALREADY_REGISTERED.
 */
export function decideEventRegistration(
  existing: EventFingerprint | null,
  incoming: EventFingerprint,
): EventRegistration {
  if (existing === null) return 'NEW';
  if (existing.type !== incoming.type) {
    throw new Error(
      `Eventos de tipos diferentes não se comparam: ${existing.type} e ${incoming.type}`,
    );
  }
  if (comparisonKey(existing) === comparisonKey(incoming)) return 'REPLAY';

  throw new DomainError('EVENT_ALREADY_REGISTERED', ALREADY_REGISTERED_MESSAGES[incoming.type], {
    type: incoming.type,
  });
}

interface PrecedingFact {
  occurredAt: Date;
  /** Mensagem quando o evento é anterior a este fato. */
  outOfOrderMessage: string;
}

/** O fato operacional mais recente da viagem, ou null se nenhum foi registrado. */
function getLatestFact(facts: TripFacts): Date | null {
  const instants = [
    facts.cteIssuedAt,
    facts.loadingPhotoAt,
    facts.unloadedAt,
    facts.proofsReceivedAt,
  ].filter((instant) => instant !== null);
  if (instants.length === 0) return null;
  return new Date(Math.max(...instants.map((instant) => instant.getTime())));
}

/**
 * O fato que precisa estar registrado antes do evento (R9), ou null para CT-e e foto, que são
 * aceitos em qualquer ordem. Lança o erro de pré-condição quando ele ainda falta. O cancelamento
 * (R13) não exige nenhum fato, mas não pode ser anterior ao último registrado.
 */
function requirePrecedingFact(type: TripEventType, facts: TripFacts): PrecedingFact | null {
  switch (type) {
    case 'CTE_ISSUED':
    case 'LOADING_PHOTO_ATTACHED':
      return null;
    case 'UNLOADED': {
      const loadedAt = getLoadedAt(facts);
      if (loadedAt === null) {
        throw new DomainError(
          'TRIP_NOT_LOADED',
          'Registre o CT-e e a foto do carregamento antes da descarga.',
        );
      }
      return {
        occurredAt: loadedAt,
        outOfOrderMessage: 'A descarga não pode ser anterior ao carregamento.',
      };
    }
    case 'PROOFS_RECEIVED': {
      if (facts.unloadedAt === null) {
        throw new DomainError(
          'UNLOADING_NOT_REGISTERED',
          'Registre a descarga antes da chegada dos comprovantes.',
        );
      }
      return {
        occurredAt: facts.unloadedAt,
        outOfOrderMessage: 'A chegada dos comprovantes não pode ser anterior à descarga.',
      };
    }
    case 'TRIP_CANCELLED': {
      const latestFact = getLatestFact(facts);
      return latestFact === null
        ? null
        : {
            occurredAt: latestFact,
            outOfOrderMessage:
              'O cancelamento não pode ser anterior ao último fato registrado da viagem.',
          };
    }
  }
}

/**
 * R9 — Pré-condições e datas de um evento novo (depois de `decideEventRegistration` dizer NEW).
 * Ordem das checagens: viagem cancelada, fato anterior ausente, data no futuro, data anterior
 * ao fato que o precede. Datas iguais ao fato anterior são aceitas.
 */
export function assertEventCanBeRegistered(
  event: { type: TripEventType; occurredAt: Date },
  trip: { status: TripStatus; facts: TripFacts },
  now: Date,
): void {
  if (trip.status === 'CANCELLED') {
    throw new DomainError(
      'TRIP_CANCELLED',
      'Esta viagem está cancelada e não aceita novos eventos.',
    );
  }

  const precedingFact = requirePrecedingFact(event.type, trip.facts);

  if (event.occurredAt.getTime() > now.getTime()) {
    throw new DomainError('INVALID_EVENT_DATE', 'A data do evento não pode estar no futuro.', {
      occurredAt: event.occurredAt.toISOString(),
    });
  }
  if (precedingFact !== null && event.occurredAt.getTime() < precedingFact.occurredAt.getTime()) {
    throw new DomainError('INVALID_EVENT_DATE', precedingFact.outOfOrderMessage, {
      occurredAt: event.occurredAt.toISOString(),
      notBefore: precedingFact.occurredAt.toISOString(),
    });
  }
}
