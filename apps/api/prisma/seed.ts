import { prisma } from '../src/infra/prisma.js';

// Placeholder da fase 1: só popula banco vazio e, por enquanto, não há nada para popular.
// O seed final usa os casos de uso (ver CLAUDE.md, seção "Seed").
async function main(): Promise<void> {
  const clients = await prisma.client.count();
  if (clients > 0) {
    console.info('Seed ignorado: o banco já tem dados.');
    return;
  }
  console.info('Seed ainda não implementado: nada a fazer.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
