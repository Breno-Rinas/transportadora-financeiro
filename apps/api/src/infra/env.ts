import { config } from 'dotenv';
import { z } from 'zod';

// Procura o .env no diretório do workspace e na raiz do monorepo. Em Docker não há
// arquivo: as variáveis vêm do ambiente. Variáveis já definidas nunca são sobrescritas.
config({ path: ['.env', '../../.env'], quiet: true });

const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://postgres:postgres@localhost:5433/transportadora'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: z.string().min(1).default('0.0.0.0'),
  BUSINESS_TZ: z
    .string()
    .refine(isValidTimeZone, 'Fuso horário inválido')
    .default('America/Sao_Paulo'),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
