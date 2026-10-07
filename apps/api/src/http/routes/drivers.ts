import type { FastifyInstance } from 'fastify';
import type { UseCaseContext } from '../../application/context.js';
import { createDriver } from '../../application/create-driver.js';
import { listDrivers } from '../../application/list-drivers.js';
import { createDriverSchema, searchQuerySchema } from '../schemas.js';
import { serializeDriver } from '../serializers.js';

export function driverRoutes(app: FastifyInstance, context: UseCaseContext): void {
  app.get('/drivers', async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const drivers = await listDrivers(context, query);
    return drivers.map(serializeDriver);
  });

  app.post('/drivers', async (request, reply) => {
    const input = createDriverSchema.parse(request.body);
    const driver = await createDriver(context, input);
    return reply.status(201).send(serializeDriver(driver));
  });
}
