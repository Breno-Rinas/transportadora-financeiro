import type {
  Attachment,
  TimelineEventEntry,
  TitleKind,
  TitleWithLocks,
  TripDetail,
  TripEventType,
} from '../../api/types';

/** O fato operacional registrado (com a data em que aconteceu), ou `undefined` se falta. */
export function findEvent(detail: TripDetail, type: TripEventType): TimelineEventEntry | undefined {
  return detail.timeline.find(
    (entry): entry is TimelineEventEntry => entry.type === 'EVENT' && entry.eventType === type,
  );
}

export function findTitle(detail: TripDetail, kind: TitleKind): TitleWithLocks | undefined {
  return detail.titles.find((title) => title.kind === kind);
}

export function findLoadingPhoto(detail: TripDetail): Attachment | undefined {
  return detail.attachments.find((attachment) => attachment.kind === 'LOADING_PHOTO');
}

/** Título que ainda aceita programar e baixar (os botões só aparecem nele). */
export function isOpenTitle(title: Pick<TitleWithLocks, 'status'>): boolean {
  return title.status === 'OPEN' || title.status === 'SCHEDULED';
}
