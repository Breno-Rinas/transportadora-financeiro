import type { FastifyInstance } from 'fastify';
import type { UseCaseContext } from '../../application/context.js';
import { createClient } from '../../application/create-client.js';
import { listClients } from '../../application/list-clients.js';
import { createClientSchema, searchQuerySchema } from '../schemas.js';
import { serializeClient } from '../serializers.js';

export function clientRoutes(app: FastifyInstance, context: UseCaseContext): void {
  app.get('/clients', async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const clients = await listClients(context, query);
    return clients.map(serializeClient);
  });

  app.post('/clients', async (request, reply) => {
    const input = createClientSchema.parse(request.body);
    const client = await createClient(context, input);
    return reply.status(201).send(serializeClient(client));
  });
}
