import { stripMask } from '../domain/shared/documents.js';
import type { Client, Prisma } from '../generated/prisma/client.js';
import type { UseCaseContext } from './context.js';

/** Clientes por razão social; `q` busca na razão social e no CNPJ (com ou sem máscara). */
export async function listClients(
  context: UseCaseContext,
  filters: { q?: string | undefined },
): Promise<Client[]> {
  return context.prisma.client.findMany({
    where: filters.q === undefined ? {} : { OR: buildSearch(filters.q) },
    orderBy: { legalName: 'asc' },
  });
}

function buildSearch(q: string): Prisma.ClientWhereInput[] {
  const search: Prisma.ClientWhereInput[] = [{ legalName: { contains: q, mode: 'insensitive' } }];
  const document = stripMask(q);
  if (document !== '') search.push({ cnpj: { contains: document } });
  return search;
}
