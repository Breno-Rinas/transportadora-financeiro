import type { FastifyInstance } from 'fastify';
import type { UseCaseContext } from '../../application/context.js';
import { listTitles } from '../../application/list-titles.js';
import { scheduleTitle } from '../../application/schedule-title.js';
import { scheduleTitles } from '../../application/schedule-titles.js';
import { settleTitle } from '../../application/settle-title.js';
import {
  idParamsSchema,
  listTitlesQuerySchema,
  scheduleTitleSchema,
  scheduleTitlesSchema,
  settleTitleSchema,
} from '../schemas.js';
import {
  serializeScheduleResult,
  serializeTitleListItem,
  serializeTitleWithLocks,
} from '../serializers.js';
import { serializeTitlesCsv } from '../titles-csv.js';

export function titleRoutes(app: FastifyInstance, context: UseCaseContext): void {
  app.get('/titles', async (request) => {
    const filters = listTitlesQuerySchema.parse(request.query);
    const titles = await listTitles(context, filters);
    return titles.map(serializeTitleListItem);
  });

  // Mesmos filtros e ordem da agenda, em CSV para o Excel pt-BR.
  app.get('/titles/export.csv', async (request, reply) => {
    const filters = listTitlesQuerySchema.parse(request.query);
    const csv = serializeTitlesCsv(await listTitles(context, filters));
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="titulos.csv"')
      .send(csv);
  });

  // R11: sempre 200; o que foi recusado vem em `rejected`, com o código e o motivo.
  app.post('/titles/schedule', async (request) => {
    const input = scheduleTitlesSchema.parse(request.body);
    return serializeScheduleResult(await scheduleTitles(context, input));
  });

  // Programação individual: 200 com o título ou o erro de domínio da recusa (ex.: 422).
  app.post('/titles/:id/schedule', async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = scheduleTitleSchema.parse(request.body);
    return serializeTitleWithLocks(await scheduleTitle(context, id, input));
  });

  app.post('/titles/:id/settle', async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = settleTitleSchema.parse(request.body);
    return serializeTitleWithLocks(await settleTitle(context, id, input));
  });
}
