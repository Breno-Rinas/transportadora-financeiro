import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Clock } from '../infra/clock.js';
import { systemClock } from '../infra/clock.js';
import { env } from '../infra/env.js';
import type { PrismaClient } from '../infra/prisma.js';
import { prisma } from '../infra/prisma.js';
import { MAX_UPLOAD_BYTES } from '../infra/storage.js';
import { registerErrorHandling } from './error-handler.js';
import { registerRoutes } from './routes/index.js';

/** Dependências injetáveis (testes trocam banco, relógio e pasta de uploads). */
export interface AppDeps {
  prisma: PrismaClient;
  clock: Clock;
  /** Pasta absoluta dos arquivos enviados, servida em `/uploads/*`. */
  uploadDir: string;
  /** Fuso de negócio (IANA): "hoje" é sempre calculado nele. */
  businessTz: string;
}

export interface BuildAppOptions extends Partial<AppDeps> {
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const deps: AppDeps = {
    prisma: options.prisma ?? prisma,
    clock: options.clock ?? systemClock,
    uploadDir: resolve(options.uploadDir ?? env.UPLOAD_DIR),
    businessTz: options.businessTz ?? env.BUSINESS_TZ,
  };

  // Mensagens de validação do Zod em pt-BR.
  z.config(z.locales.ptBR());

  const app = Fastify({ logger: options.logger ?? env.NODE_ENV !== 'test' });

  registerErrorHandling(app);

  void app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  });
  void app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  mkdirSync(deps.uploadDir, { recursive: true });
  void app.register(fastifyStatic, {
    root: deps.uploadDir,
    prefix: '/uploads/',
    setHeaders: (reply) => {
      void reply.header('X-Content-Type-Options', 'nosniff');
    },
  });

  registerRoutes(app, deps);

  return app;
}
