// Mesmos valores dos enums do Prisma; o domínio não importa o client gerado.

/** Ciclo de vida persistido da viagem (R8). CANCELLED é terminal e fora da sequência (R13). */
export type TripStatus =
  | 'CREATED'
  | 'LOADED'
  | 'ADVANCE_PAID'
  | 'UNLOADED'
  | 'PROOFS_RECEIVED'
  | 'BALANCE_PAID'
  | 'CANCELLED';

/** Fatos operacionais; no máximo um de cada tipo por viagem (R6). */
export type TripEventType =
  'CTE_ISSUED' | 'LOADING_PHOTO_ATTACHED' | 'UNLOADED' | 'PROOFS_RECEIVED' | 'TRIP_CANCELLED';
