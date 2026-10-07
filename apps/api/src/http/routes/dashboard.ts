import type { FastifyInstance } from 'fastify';
import type { UseCaseContext } from '../../application/context.js';
import { getDashboard } from '../../application/get-dashboard.js';
import { dashboardQuerySchema } from '../schemas.js';
import { serializeDashboard } from '../serializers.js';

export function dashboardRoutes(app: FastifyInstance, context: UseCaseContext): void {
  app.get('/dashboard', async (request) => {
    const query = dashboardQuerySchema.parse(request.query);
    return serializeDashboard(await getDashboard(context, query));
  });
}
