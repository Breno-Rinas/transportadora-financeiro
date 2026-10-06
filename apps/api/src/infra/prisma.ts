import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { env } from './env.js';

export { PrismaClient };

/** Cliente transacional recebido dentro de `prisma.$transaction(async (tx) => ...)`. */
export type PrismaTx = Prisma.TransactionClient;

export function createPrismaClient(connectionString: string = env.DATABASE_URL): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma: PrismaClient = createPrismaClient();
