import type { FastifyInstance } from 'fastify';
import type { UseCaseContext } from '../../application/context.js';
import { listTitles } from '../../application/list-titles.js';
import { scheduleTitles } from '../../application/schedule-titles.js';
import { settleTitle } from '../../application/settle-title.js';
import {
  idParamsSchema,
  listTitlesQuerySchema,
  scheduleTitlesSchema,
  settleTitleSchema,
} from '../schemas.js';
import {
  serializeScheduleResult,
  serializeTitleListItem,
  serializeTitleWithLocks,
} from '../serializers.js';

export function titleRoutes(app: FastifyInstance, context: UseCaseContext): void {
  app.get('/titles', async (request) => {
    const filters = listTitlesQuerySchema.parse(request.query);
    const titles = await listTitles(context, filters);
    return titles.map(serializeTitleListItem);
  });

  // R11: sempre 200; o que foi recusado vem em `rejected`, com o código e o motivo.
  app.post('/titles/schedule', async (request) => {
    const input = scheduleTitlesSchema.parse(request.body);
    return serializeScheduleResult(await scheduleTitles(context, input));
  });

  app.post('/titles/:id/settle', async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = settleTitleSchema.parse(request.body);
    return serializeTitleWithLocks(await settleTitle(context, id, input));
  });
}
