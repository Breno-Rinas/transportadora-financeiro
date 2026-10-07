import type { FastifyInstance } from 'fastify';
import type { UseCaseContext } from '../../application/context.js';
import { createDiskStorage } from '../../infra/storage.js';
import type { AppDeps } from '../app.js';
import { clientRoutes } from './clients.js';
import { dashboardRoutes } from './dashboard.js';
import { driverRoutes } from './drivers.js';
import { healthRoutes } from './health.js';
import { titleRoutes } from './titles.js';
import { tripRoutes } from './trips.js';

/** Registra todas as rotas sob o prefixo `/api`. Rotas de domínio entram aqui. */
export function registerRoutes(app: FastifyInstance, deps: AppDeps): void {
  const context: UseCaseContext = {
    prisma: deps.prisma,
    clock: deps.clock,
    businessTz: deps.businessTz,
    storage: createDiskStorage(deps.uploadDir),
  };

  void app.register(
    (api) => {
      healthRoutes(api);
      clientRoutes(api, context);
      driverRoutes(api, context);
      tripRoutes(api, context);
      titleRoutes(api, context);
      dashboardRoutes(api, context);
    },
    { prefix: '/api' },
  );
}
