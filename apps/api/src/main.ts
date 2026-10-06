import { buildApp } from './http/app.js';
import { env } from './infra/env.js';
import { prisma } from './infra/prisma.js';

async function main(): Promise<void> {
  const app = buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Encerrando');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
