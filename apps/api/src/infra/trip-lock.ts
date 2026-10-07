import { DomainError } from '../domain/errors.js';
import type { PrismaTx } from './prisma.js';

/**
 * Trava a linha da viagem até o fim da transação (`SELECT ... FOR UPDATE`). Toda mutação de
 * viagem ou título começa por aqui, para que eventos concorrentes da mesma viagem (ex.: CT-e e
 * foto chegando juntos) sejam processados um de cada vez, cada um vendo o estado do anterior.
 */
export async function lockTrip(tx: PrismaTx, tripId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`;
  if (rows.length === 0) {
    throw new DomainError('NOT_FOUND', 'Viagem não encontrada.', { tripId });
  }
}
