import { parseCnpj } from '../domain/shared/documents.js';
import type { Client } from '../generated/prisma/client.js';
import { clientCnpjInUse, withUniqueViolationsAsDomainErrors } from './conflicts.js';
import type { UseCaseContext } from './context.js';

export interface CreateClientInput {
  legalName: string;
  /** Com ou sem máscara; é salvo só com dígitos/letras (R12). */
  cnpj: string;
  paymentTermDays: number;
}

export async function createClient(
  context: UseCaseContext,
  input: CreateClientInput,
): Promise<Client> {
  const cnpj = parseCnpj(input.cnpj);

  return withUniqueViolationsAsDomainErrors(() =>
    context.prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({ where: { cnpj }, select: { id: true } });
      if (existing !== null) throw clientCnpjInUse();

      return tx.client.create({
        data: {
          legalName: input.legalName,
          cnpj,
          paymentTermDays: input.paymentTermDays,
          createdAt: context.clock.now(),
        },
      });
    }),
  );
}
