import { stripMask } from '../domain/shared/documents.js';
import type { Driver, Prisma } from '../generated/prisma/client.js';
import type { UseCaseContext } from './context.js';

/** Motoristas por nome; `q` busca no nome, no documento e na placa (com ou sem máscara). */
export async function listDrivers(
  context: UseCaseContext,
  filters: { q?: string | undefined },
): Promise<Driver[]> {
  return context.prisma.driver.findMany({
    where: filters.q === undefined ? {} : { OR: buildSearch(filters.q) },
    orderBy: { name: 'asc' },
  });
}

function buildSearch(q: string): Prisma.DriverWhereInput[] {
  const search: Prisma.DriverWhereInput[] = [{ name: { contains: q, mode: 'insensitive' } }];
  const unmasked = stripMask(q);
  if (unmasked !== '') {
    search.push({ document: { contains: unmasked } }, { vehiclePlate: { contains: unmasked } });
  }
  return search;
}
