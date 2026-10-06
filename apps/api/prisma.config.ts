import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env', '../../.env'], quiet: true });

// Mesmo padrão de desenvolvimento do .env.example (docker compose, porta 5433).
const DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5433/transportadora';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
