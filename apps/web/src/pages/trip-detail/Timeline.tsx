import {
  IconArrowsExchange,
  IconBan,
  IconCamera,
  IconCash,
  IconFileCheck,
  IconFileInvoice,
  IconHistory,
  IconPackageExport,
  type Icon,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type {
  TimelineEntry,
  TimelineEventEntry,
  TimelinePaymentEntry,
  TimelineStatusChangeEntry,
  TripDetail,
  TripEventType,
} from '../../api/types';
import { EmptyState, Money, PhotoPreview } from '../../components';
import { formatDate, formatDateTime } from '../../lib/format';
import {
  TITLE_KIND_LABEL,
  TRIP_EVENT_LABEL,
  TRIP_STATUS_LABEL,
  statusTriggerLabel,
} from '../../lib/labels';
import classes from './TripDetail.module.css';

const EVENT_ICON: Record<TripEventType, Icon> = {
  CTE_ISSUED: IconFileInvoice,
  LOADING_PHOTO_ATTACHED: IconCamera,
  UNLOADED: IconPackageExport,
  PROOFS_RECEIVED: IconFileCheck,
  TRIP_CANCELLED: IconBan,
};

interface EntryViewProps {
  icon: Icon;
  tone: string;
  title: ReactNode;
  at: string;
  children?: ReactNode;
}

function EntryView({ icon: EntryIcon, tone, title, at, children }: EntryViewProps) {
  return (
    <li className={classes.entry}>
      <span className={`${classes.entryIcon} ${tone}`} aria-hidden="true">
        <EntryIcon size={13} stroke={1.7} />
      </span>
      <div className={classes.entryBody}>
        <span className={classes.entryTitle}>{title}</span>
        <span className={classes.entryMeta}>{formatDateTime(at)}</span>
        {children}
      </div>
    </li>
  );
}

function EventEntry({ entry, detail }: { entry: TimelineEventEntry; detail: TripDetail }) {
  const photo = entry.attachmentId
    ? detail.attachments.find((attachment) => attachment.id === entry.attachmentId)
    : undefined;
  const cte = entry.cteId && detail.cte?.id === entry.cteId ? detail.cte : undefined;

  return (
    <EntryView
      icon={EVENT_ICON[entry.eventType]}
      tone={entry.eventType === 'TRIP_CANCELLED' ? classes.entryCancel : classes.entryEvent}
      title={TRIP_EVENT_LABEL[entry.eventType]}
      at={entry.at}
    >
      {cte ? (
        <span className={classes.entryMeta}>
          CT-e nº {cte.number} · série {cte.series} · <Money cents={cte.clientFreightCents} />
        </span>
      ) : null}
      {entry.note ? <span className={classes.entryMeta}>{entry.note}</span> : null}
      {photo ? (
        <div className={classes.entryPhoto}>
          <PhotoPreview
            src={photo.url}
            alt={`Foto do carregamento · ${photo.originalName}`}
            height={86}
          />
        </div>
      ) : null}
    </EntryView>
  );
}

function StatusChangeEntry({ entry }: { entry: TimelineStatusChangeEntry }) {
  return (
    <EntryView
      icon={IconArrowsExchange}
      tone={classes.entryStatus}
      title={
        <>
          {entry.fromStatus ? `${TRIP_STATUS_LABEL[entry.fromStatus]} → ` : 'Início → '}
          <strong>{TRIP_STATUS_LABEL[entry.toStatus]}</strong>
        </>
      }
      at={entry.at}
    >
      <span className={classes.entryMeta}>{statusTriggerLabel(entry.trigger)}</span>
    </EntryView>
  );
}

function PaymentEntry({ entry }: { entry: TimelinePaymentEntry }) {
  return (
    <EntryView
      icon={IconCash}
      tone={classes.entryPayment}
      title={
        <>
          Baixa: {TITLE_KIND_LABEL[entry.titleKind]} · <Money cents={entry.amountCents} />
        </>
      }
      at={entry.at}
    >
      <span className={classes.entryMeta}>Data do pagamento: {formatDate(entry.paidOn)}</span>
      {entry.note ? <span className={classes.entryMeta}>{entry.note}</span> : null}
    </EntryView>
  );
}

function renderEntry(entry: TimelineEntry, detail: TripDetail) {
  switch (entry.type) {
    case 'EVENT':
      return <EventEntry key={`event-${entry.id}`} entry={entry} detail={detail} />;
    case 'STATUS_CHANGE':
      return <StatusChangeEntry key={`status-${entry.id}`} entry={entry} />;
    case 'PAYMENT':
      return <PaymentEntry key={`payment-${entry.id}`} entry={entry} />;
  }
}

/** Linha do tempo da API (do mais antigo ao mais novo), com ícone por tipo e a foto ampliável. */
export function Timeline({ detail }: { detail: TripDetail }) {
  return (
    <section className={classes.section} aria-label="Linha do tempo">
      <h2 className={classes.sectionTitle}>
        Linha do tempo
        <span className={classes.sectionCount}>{detail.timeline.length}</span>
      </h2>
      {detail.timeline.length === 0 ? (
        <EmptyState
          compact
          icon={<IconHistory size={18} stroke={1.5} />}
          title="Nada registrado ainda"
          description="Os eventos, as mudanças de status e as baixas aparecem aqui, em ordem cronológica."
        />
      ) : (
        <ol className={classes.timeline}>
          {detail.timeline.map((entry) => renderEntry(entry, detail))}
        </ol>
      )}
    </section>
  );
}
