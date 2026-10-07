import { Text } from '@mantine/core';
import { IconEye, IconPackage, IconUser } from '@tabler/icons-react';
import type { TripListItem } from '../../api/types';
import {
  CardActions,
  CardButton,
  EntityCard,
  MarginBadge,
  MetaLine,
  Money,
  NoteBox,
  RouteLine,
  TripStatusBadge,
} from '../../components';
import { formatInstantDate, formatTripCode, formatWeightKg } from '../../lib/format';
import { paths } from '../../lib/routes';

/** Card de viagem do quadro: cliente, rota, frete, margem, próximo passo e botão "Detalhes". */
export function TripCard({ trip }: { trip: TripListItem }) {
  const nextStep = trip.pendingSteps[0];
  const negativeMargin = trip.margin?.isNegative === true;

  return (
    <EntityCard
      accent={negativeMargin ? 'red' : trip.status === 'CANCELLED' ? 'gray' : 'indigo'}
      title={trip.client.legalName}
      badge={<TripStatusBadge status={trip.status} />}
      code={formatTripCode(trip.code)}
      actions={
        <CardActions>
          <CardButton
            tone="indigo"
            icon={<IconEye size={13} stroke={1.5} />}
            to={paths.trip(trip.id)}
          >
            Detalhes
          </CardButton>
        </CardActions>
      }
    >
      <RouteLine origin={trip.origin} destination={trip.destination} />
      <MetaLine
        icon={<IconPackage size={12} stroke={1.5} />}
        left={`${trip.product} · ${formatWeightKg(trip.weightKg)}`}
      />
      <MetaLine
        left={formatInstantDate(trip.createdAt)}
        right={<Money cents={trip.clientFreightCents} />}
      />
      <MetaLine
        icon={<IconUser size={12} stroke={1.5} />}
        left={trip.driver.name}
        right={
          <Text span inherit c="dimmed" fw={500}>
            <Money cents={trip.driverFreightCents} />
          </Text>
        }
      />
      {trip.margin ? (
        <MetaLine
          icon={null}
          left={
            negativeMargin ? (
              <MarginBadge margin={trip.margin} negativeLabel showPercent={false} size="xs" />
            ) : (
              `Margem${trip.margin.kind === 'PROJECTED' ? ' proj.' : ''}`
            )
          }
          right={
            negativeMargin ? undefined : (
              <MarginBadge margin={trip.margin} showPercent={false} showKind={false} size="xs" />
            )
          }
        />
      ) : null}
      {nextStep ? (
        <NoteBox>{nextStep.message}</NoteBox>
      ) : (
        <NoteBox variant="success">Sem pendências</NoteBox>
      )}
    </EntityCard>
  );
}
