import type { Clock } from '../infra/clock.js';
import type { PrismaClient } from '../infra/prisma.js';
import type { FileStorage } from '../infra/storage.js';

/** Dependências dos casos de uso (o HTTP e o seed montam; os testes trocam banco e relógio). */
export interface UseCaseContext {
  prisma: PrismaClient;
  clock: Clock;
  /** Fuso de negócio (IANA): "hoje" é sempre calculado nele. */
  businessTz: string;
  storage: FileStorage;
}
