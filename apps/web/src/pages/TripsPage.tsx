import { Button, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTruckDelivery, IconX } from '@tabler/icons-react';
import { useClients, useDrivers, useTrips } from '../api/hooks';
import type { TripListItem, TripStatus } from '../api/types';
import {
  Board,
  BoardColumn,
  BoardSkeleton,
  EmptyState,
  ErrorState,
  FilterSelect,
  PageHeader,
  Pill,
  SearchInput,
} from '../components';
import { formatDate, maskPlate } from '../lib/format';
import {
  TRIP_STATUS_BOARD_ORDER,
  TRIP_STATUS_FILTER_ORDER,
  TRIP_STATUS_LABEL,
} from '../lib/labels';
import { NewTripModal } from './trips/NewTripModal';
import { TripCard } from './trips/TripCard';
import { useTripFilters } from './trips/use-trip-filters';

function groupByStatus(trips: readonly TripListItem[]): Map<TripStatus, TripListItem[]> {
  const groups = new Map<TripStatus, TripListItem[]>();
  for (const trip of trips) {
    const group = groups.get(trip.status);
    if (group) group.push(trip);
    else groups.set(trip.status, [trip]);
  }
  return groups;
}

const STATUS_OPTIONS = TRIP_STATUS_FILTER_ORDER.map((status) => ({
  value: status,
  label: TRIP_STATUS_LABEL[status],
}));

export function TripsPage() {
  const {
    search,
    status,
    clientId,
    driverId,
    from,
    to,
    filters,
    hasFilters,
    setFilter,
    setFilters,
    clear,
  } = useTripFilters();
  const [modalOpened, modal] = useDisclosure(false);

  const trips = useTrips(filters);
  const clients = useClients();
  const drivers = useDrivers();

  const clientOptions = (clients.data ?? []).map((client) => ({
    value: client.id,
    label: client.legalName,
  }));
  const driverOptions = (drivers.data ?? []).map((driver) => ({
    value: driver.id,
    label: `${driver.name} · ${maskPlate(driver.vehiclePlate)}`,
  }));

  function renderContent() {
    if (trips.isPending) return <BoardSkeleton columns={5} />;
    if (trips.isError) {
      return (
        <ErrorState
          title="Não foi possível carregar as viagens"
          error={trips.error}
          onRetry={() => void trips.refetch()}
          retrying={trips.isRefetching}
        />
      );
    }
    if (trips.data.length === 0) {
      return hasFilters ? (
        <EmptyState
          icon={<IconTruckDelivery size={18} stroke={1.5} />}
          title="Nenhuma viagem encontrada"
          description="Nenhuma viagem combina com os filtros. Ajuste a busca ou limpe os filtros."
          action={
            <Button size="xs" variant="default" onClick={clear}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<IconTruckDelivery size={18} stroke={1.5} />}
          title="Nenhuma viagem ainda"
          description="Clique em Nova viagem para começar."
          action={
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={modal.open}>
              Nova viagem
            </Button>
          }
        />
      );
    }

    const groups = groupByStatus(trips.data);
    // A coluna "Cancelada" só aparece quando há viagem cancelada ou quando o filtro a pede.
    const columnStatuses: readonly TripStatus[] = status
      ? [status]
      : groups.has('CANCELLED')
        ? [...TRIP_STATUS_BOARD_ORDER, 'CANCELLED']
        : TRIP_STATUS_BOARD_ORDER;
    return (
      <div style={{ opacity: trips.isPlaceholderData ? 0.6 : 1, transition: 'opacity 120ms' }}>
        <Board label="Viagens por status">
          {columnStatuses.map((columnStatus) => {
            const items = groups.get(columnStatus) ?? [];
            return (
              <BoardColumn
                key={columnStatus}
                label={TRIP_STATUS_LABEL[columnStatus]}
                count={items.length}
                emptyText="Sem viagens"
              >
                {items.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </BoardColumn>
            );
          })}
        </Board>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Viagens">
        <SearchInput
          value={search}
          onChange={(value) => setFilter('q', value)}
          placeholder="Cliente, origem ou destino…"
          aria-label="Buscar viagens"
          w={220}
        />
        <FilterSelect
          placeholder="Todos os clientes"
          aria-label="Filtrar por cliente"
          data={clientOptions}
          value={clientId ?? null}
          onChange={(value) => setFilter('clientId', value)}
          searchable
          w={180}
        />
        <FilterSelect
          placeholder="Todos os motoristas"
          aria-label="Filtrar por motorista"
          data={driverOptions}
          value={driverId ?? null}
          onChange={(value) => setFilter('driverId', value)}
          searchable
          w={190}
        />
        <FilterSelect
          placeholder="Todos os status"
          aria-label="Filtrar por status"
          data={STATUS_OPTIONS}
          value={status ?? null}
          onChange={(value) => setFilter('status', value)}
          w={165}
        />
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={modal.open}>
          Nova viagem
        </Button>
      </PageHeader>

      {from || to ? (
        <Group gap={6} mb={12}>
          <Pill color="indigo">
            Criadas de {formatDate(from)} a {formatDate(to)}
          </Pill>
          <Button
            variant="subtle"
            size="compact-xs"
            leftSection={<IconX size={12} />}
            onClick={() => setFilters({ from: null, to: null })}
          >
            Remover período
          </Button>
        </Group>
      ) : null}

      {renderContent()}

      <NewTripModal opened={modalOpened} onClose={modal.close} />
    </>
  );
}
