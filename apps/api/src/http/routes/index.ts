import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';
import { healthRoutes } from './health.js';

/** Registra todas as rotas sob o prefixo `/api`. Rotas de domínio entram aqui. */
export function registerRoutes(app: FastifyInstance, _deps: AppDeps): void {
  void app.register(
    (api) => {
      healthRoutes(api);
    },
    { prefix: '/api' },
  );
}
