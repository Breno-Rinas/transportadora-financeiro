import { assertEventCanBeRegistered, decideEventRegistration } from '../domain/trip/event-rules.js';
import type { ImageUpload } from '../infra/storage.js';
import type { UseCaseContext } from './context.js';
import { registerTripEvent, type TripEventResult } from './trip-event.js';
import { getRegisteredFingerprint } from './trip-state.js';

export interface AttachLoadingPhotoInput {
  file: ImageUpload;
  /** Quando a foto foi tirada; sem valor, vale o momento do envio. */
  occurredAt?: Date | undefined;
}

/**
 * Anexa a foto do carregamento (fato LOADING_PHOTO_ATTACHED). Com o CT-e, gera os títulos (R1).
 * O reenvio é reconhecido pelo sha256 do arquivo (R6). O arquivo só é gravado em disco quando o
 * evento é novo, e é apagado se a transação falhar.
 */
export async function attachLoadingPhoto(
  context: UseCaseContext,
  tripId: string,
  input: AttachLoadingPhotoInput,
): Promise<TripEventResult> {
  const image = context.storage.inspectImage(input.file);
  const saved: { storagePath?: string } = {};

  try {
    return await registerTripEvent(context, tripId, async (tx, state, now) => {
      const decision = decideEventRegistration(
        getRegisteredFingerprint(state, 'LOADING_PHOTO_ATTACHED'),
        { type: 'LOADING_PHOTO_ATTACHED', sha256: image.sha256 },
      );
      if (decision === 'REPLAY') return decision;

      const occurredAt = input.occurredAt ?? now;
      assertEventCanBeRegistered(
        { type: 'LOADING_PHOTO_ATTACHED', occurredAt },
        { status: state.trip.status, facts: state.facts },
        now,
      );

      saved.storagePath = await context.storage.save(image);
      const attachment = await tx.attachment.create({
        data: {
          tripId,
          kind: 'LOADING_PHOTO',
          storagePath: saved.storagePath,
          originalName: image.originalName,
          mimeType: image.mimeType,
          sizeBytes: image.sizeBytes,
          sha256: image.sha256,
          createdAt: now,
        },
      });
      await tx.tripEvent.create({
        data: {
          tripId,
          type: 'LOADING_PHOTO_ATTACHED',
          occurredAt,
          recordedAt: now,
          attachmentId: attachment.id,
        },
      });
      return decision;
    });
  } catch (error) {
    if (saved.storagePath !== undefined) await context.storage.remove(saved.storagePath);
    throw error;
  }
}
