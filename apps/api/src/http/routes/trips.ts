import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { attachLoadingPhoto } from '../../application/attach-loading-photo.js';
import type { UseCaseContext } from '../../application/context.js';
import { createTrip } from '../../application/create-trip.js';
import { getTripDetail } from '../../application/get-trip-detail.js';
import { listTrips } from '../../application/list-trips.js';
import { registerCte } from '../../application/register-cte.js';
import { registerProofs } from '../../application/register-proofs.js';
import { registerUnloading } from '../../application/register-unloading.js';
import type { TripEventResult } from '../../application/trip-event.js';
import { DomainError } from '../../domain/errors.js';
import {
  createTripSchema,
  idParamsSchema,
  listTripsQuerySchema,
  loadingPhotoFormSchema,
  registerCteSchema,
  registerProofsSchema,
  registerUnloadingSchema,
} from '../schemas.js';
import { serializeTripDetail, serializeTripListItem } from '../serializers.js';

/** Evento novo: 201. Reenvio idêntico (R6): 200 com o estado atual. */
function sendEventResult(reply: FastifyReply, result: TripEventResult): FastifyReply {
  return reply.status(result.replayed ? 200 : 201).send(serializeTripDetail(result.detail));
}

/**
 * Lê o multipart inteiro (campos e o arquivo `file`, em qualquer ordem). O limite de 10 MB do
 * plugin faz `toBuffer` falhar com 413 antes de o arquivo chegar à memória por inteiro.
 */
async function readLoadingPhotoForm(request: FastifyRequest): Promise<Record<string, unknown>> {
  if (!request.isMultipart()) {
    const message = 'Envie a foto como multipart/form-data, no campo "file".';
    throw new DomainError('VALIDATION_ERROR', message, [{ path: 'file', message }]);
  }
  const form: Record<string, unknown> = {};
  for await (const part of request.parts()) {
    if (part.type === 'field') {
      form[part.fieldname] = part.value;
    } else if (part.fieldname === 'file') {
      form.file = { buffer: await part.toBuffer(), filename: part.filename };
    } else {
      part.file.resume();
    }
  }
  return form;
}

export function tripRoutes(app: FastifyInstance, context: UseCaseContext): void {
  app.get('/trips', async (request) => {
    const filters = listTripsQuerySchema.parse(request.query);
    const trips = await listTrips(context, filters);
    return trips.map(serializeTripListItem);
  });

  app.post('/trips', async (request, reply) => {
    const input = createTripSchema.parse(request.body);
    const detail = await createTrip(context, input);
    return reply.status(201).send(serializeTripDetail(detail));
  });

  app.get('/trips/:id', async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return serializeTripDetail(await getTripDetail(context, id));
  });

  app.post('/trips/:id/cte', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = registerCteSchema.parse(request.body);
    return sendEventResult(reply, await registerCte(context, id, input));
  });

  app.post('/trips/:id/loading-photo', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const form = loadingPhotoFormSchema.parse(await readLoadingPhotoForm(request));
    const result = await attachLoadingPhoto(context, id, {
      file: { buffer: form.file.buffer, originalName: form.file.filename },
      occurredAt: form.occurredAt,
    });
    return sendEventResult(reply, result);
  });

  app.post('/trips/:id/unloading', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = registerUnloadingSchema.parse(request.body);
    return sendEventResult(reply, await registerUnloading(context, id, input));
  });

  app.post('/trips/:id/proofs', async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const input = registerProofsSchema.parse(request.body);
    return sendEventResult(reply, await registerProofs(context, id, input));
  });
}
