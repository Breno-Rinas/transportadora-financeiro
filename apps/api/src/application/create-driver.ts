import { parseDriverDocument, parsePlate } from '../domain/shared/documents.js';
import type { Driver } from '../generated/prisma/client.js';
import { driverDocumentInUse, withUniqueViolationsAsDomainErrors } from './conflicts.js';
import type { UseCaseContext } from './context.js';

export interface CreateDriverInput {
  name: string;
  /** CPF ou CNPJ, com ou sem máscara; é salvo só com dígitos/letras (R12). */
  document: string;
  /** Antiga ou Mercosul, com ou sem máscara. */
  vehiclePlate: string;
  pixKey: string;
}

export async function createDriver(
  context: UseCaseContext,
  input: CreateDriverInput,
): Promise<Driver> {
  const document = parseDriverDocument(input.document);
  const vehiclePlate = parsePlate(input.vehiclePlate);

  return withUniqueViolationsAsDomainErrors(() =>
    context.prisma.$transaction(async (tx) => {
      const existing = await tx.driver.findUnique({ where: { document }, select: { id: true } });
      if (existing !== null) throw driverDocumentInUse();

      return tx.driver.create({
        data: {
          name: input.name,
          document,
          vehiclePlate,
          pixKey: input.pixKey,
          createdAt: context.clock.now(),
        },
      });
    }),
  );
}
