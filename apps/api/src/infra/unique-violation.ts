import { Prisma } from '../generated/prisma/client.js';

/**
 * Nome do índice único violado quando o erro é um P2002 do Prisma; null para qualquer outro erro
 * (ou se o nome não vier). Com o driver adapter `pg`, o nome está em
 * `meta.driverAdapterError.cause.constraint.index` (ex.: `ctes_series_number_key`).
 */
export function getViolatedUniqueIndex(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const index = readPath(error.meta, ['driverAdapterError', 'cause', 'constraint', 'index']);
  return typeof index === 'string' ? index : null;
}

function readPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = Reflect.get(current, key);
  }
  return current;
}
