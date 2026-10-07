import { Skeleton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowLeft, IconBan } from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { useTrip } from '../api/hooks';
import type { TripDetail } from '../api/types';
import { ErrorState, NoteBox } from '../components';
import { formatDateTime } from '../lib/format';
import { paths } from '../lib/routes';
import { useModalTarget } from '../lib/use-modal-target';
import { ScheduleTitleModal } from './titles/ScheduleTitleModal';
import { SettleTitleModal } from './titles/SettleTitleModal';
import type { TitleTarget } from './titles/title-target';
import { CancelTripModal } from './trip-detail/CancelTripModal';
import { EventCards } from './trip-detail/EventCards';
import { findEvent } from './trip-detail/helpers';
import { PendingSteps } from './trip-detail/PendingSteps';
import { TitleCards } from './trip-detail/TitleCards';
import { Timeline } from './trip-detail/Timeline';
import classes from './trip-detail/TripDetail.module.css';
import { TripHeader } from './trip-detail/TripHeader';
import { ValueCards } from './trip-detail/ValueCards';

function BackLink() {
  return (
    <Link to={paths.trips} className={classes.back}>
      <IconArrowLeft size={13} stroke={1.6} />
      Viagens
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className={classes.page} aria-busy="true" aria-label="Carregando a viagem">
      <Skeleton height={104} radius="md" />
      <Skeleton height={44} radius="md" />
      <div className={classes.values}>
        <Skeleton height={86} radius="md" />
        <Skeleton height={86} radius="md" />
        <Skeleton height={86} radius="md" />
      </div>
      <div className={classes.columns}>
        <div className={classes.column}>
          <Skeleton height={150} radius="md" />
          <Skeleton height={150} radius="md" />
          <Skeleton height={150} radius="md" />
        </div>
        <div className={classes.column}>
          <Skeleton height={170} radius="md" />
          <Skeleton height={240} radius="md" />
        </div>
      </div>
    </div>
  );
}

/** Aviso de cancelamento com o motivo informado (nota do fato `TRIP_CANCELLED`). */
function CancelledNotice({ detail }: { detail: TripDetail }) {
  const event = findEvent(detail, 'TRIP_CANCELLED');
  return (
    <NoteBox variant="danger" size="md" icon={<IconBan size={16} stroke={1.6} />} lines={4}>
      {event
        ? `Viagem cancelada em ${formatDateTime(event.at)}${event.note ? `. Motivo: ${event.note}` : '.'}`
        : 'Viagem cancelada.'}
    </NoteBox>
  );
}

export function TripDetailPage() {
  const { id } = useParams();
  const trip = useTrip(id);
  const schedule = useModalTarget<TitleTarget>();
  const settle = useModalTarget<TitleTarget>();
  const [cancelOpened, cancelModal] = useDisclosure(false);

  // Se um refetch em segundo plano falhar, a tela continua com os dados que já tem.
  if (!trip.data) {
    return (
      <div className={classes.page}>
        <BackLink />
        {trip.isError ? (
          <ErrorState
            title="Não foi possível carregar a viagem"
            error={trip.error}
            onRetry={() => void trip.refetch()}
            retrying={trip.isRefetching}
          />
        ) : (
          <DetailSkeleton />
        )}
      </div>
    );
  }

  const detail = trip.data;
  const cancelled = detail.trip.status === 'CANCELLED';

  return (
    <div className={classes.page}>
      <BackLink />
      <TripHeader detail={detail} onCancel={cancelModal.open} />
      {cancelled ? <CancelledNotice detail={detail} /> : null}
      <PendingSteps steps={detail.pendingSteps} cancelled={cancelled} />
      <ValueCards detail={detail} />

      <div className={classes.columns}>
        <EventCards detail={detail} />
        <div className={classes.column}>
          <TitleCards detail={detail} onSchedule={schedule.open} onSettle={settle.open} />
          <Timeline detail={detail} />
        </div>
      </div>

      <ScheduleTitleModal
        target={schedule.target}
        opened={schedule.opened}
        onClose={schedule.close}
      />
      <SettleTitleModal target={settle.target} opened={settle.opened} onClose={settle.close} />
      <CancelTripModal
        tripId={detail.trip.id}
        tripCode={detail.trip.code}
        opened={cancelOpened}
        onClose={cancelModal.close}
      />
    </div>
  );
}
