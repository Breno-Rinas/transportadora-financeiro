import type { TitleKind, TitleStatus } from '../title/types.js';
import type { TripEventType } from './types.js';

/**
 * O que já aconteceu na viagem, na forma que as regras consultam. É a entrada comum do ciclo de
 * vida (R8), das pré-condições dos eventos (R9), da geração de títulos (R1), das travas (R4/R5)
 * e dos próximos passos. Null significa que o fato ainda não foi registrado.
 */
export interface TripFacts {
  /** `occurredAt` do evento CTE_ISSUED, que é a emissão do CT-e (`cte.issuedAt`). */
  cteIssuedAt: Date | null;
  loadingPhotoAt: Date | null;
  unloadedAt: Date | null;
  proofsReceivedAt: Date | null;
  /** Status dos títulos do motorista; null enquanto os títulos não foram gerados. */
  advanceStatus: TitleStatus | null;
  balanceStatus: TitleStatus | null;
}

export interface RecordedEvent {
  type: TripEventType;
  occurredAt: Date;
}

export interface TitleState {
  kind: TitleKind;
  status: TitleStatus;
}

/** Monta os fatos a partir dos eventos e dos títulos persistidos da viagem. */
export function buildTripFacts(
  events: readonly RecordedEvent[],
  titles: readonly TitleState[],
): TripFacts {
  const occurredAt = (type: TripEventType): Date | null =>
    events.find((event) => event.type === type)?.occurredAt ?? null;
  const statusOf = (kind: TitleKind): TitleStatus | null =>
    titles.find((title) => title.kind === kind)?.status ?? null;

  return {
    cteIssuedAt: occurredAt('CTE_ISSUED'),
    loadingPhotoAt: occurredAt('LOADING_PHOTO_ATTACHED'),
    unloadedAt: occurredAt('UNLOADED'),
    proofsReceivedAt: occurredAt('PROOFS_RECEIVED'),
    advanceStatus: statusOf('ADVANCE'),
    balanceStatus: statusOf('BALANCE'),
  };
}

/**
 * Instante do carregamento: o mais tarde entre o CT-e e a foto (R3), que chegam em qualquer
 * ordem (R1). Null enquanto faltar um dos dois.
 */
export function getLoadedAt(facts: TripFacts): Date | null {
  const { cteIssuedAt, loadingPhotoAt } = facts;
  if (cteIssuedAt === null || loadingPhotoAt === null) return null;
  return cteIssuedAt.getTime() >= loadingPhotoAt.getTime() ? cteIssuedAt : loadingPhotoAt;
}

export function isLoaded(facts: TripFacts): boolean {
  return getLoadedAt(facts) !== null;
}
