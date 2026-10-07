import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  cancelTrip,
  createClient,
  createDriver,
  createTrip,
  getDashboard,
  getTrip,
  listClients,
  listDrivers,
  listTitles,
  listTrips,
  registerCte,
  registerProofs,
  registerUnloading,
  scheduleTitle,
  scheduleTitles,
  settleTitle,
  uploadLoadingPhoto,
} from './endpoints';
import { useApiMutation } from './mutation';
import { queryKeys } from './query-keys';
import type {
  CancelTripInput,
  CreateClientInput,
  CreateDriverInput,
  CreateTripInput,
  DashboardQuery,
  RegisterCteInput,
  RegisterProofsInput,
  RegisterUnloadingInput,
  ScheduleResult,
  ScheduleTitleInput,
  ScheduleTitlesInput,
  SettleTitleInput,
  TitleFilters,
  TripFilters,
  UploadLoadingPhotoInput,
} from './types';
import { formatDate, formatTripCode } from '../lib/format';

/** O painel se atualiza sozinho: um analista deixa a aba aberta o dia todo. */
const DASHBOARD_REFETCH_MS = 30_000;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useDashboard(query: DashboardQuery = {}) {
  return useQuery({
    queryKey: queryKeys.dashboard(query),
    queryFn: ({ signal }) => getDashboard(query, signal),
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

/** Mantém a lista anterior na tela enquanto os filtros mudam (`isPlaceholderData` indica isso). */
export function useTrips(filters: TripFilters) {
  return useQuery({
    queryKey: queryKeys.trips(filters),
    queryFn: ({ signal }) => listTrips(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trip(id ?? ''),
    queryFn: ({ signal }) => getTrip(id ?? '', signal),
    enabled: id !== undefined,
  });
}

export function useTitles(filters: TitleFilters) {
  return useQuery({
    queryKey: queryKeys.titles(filters),
    queryFn: ({ signal }) => listTitles(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useClients(q?: string) {
  return useQuery({
    queryKey: queryKeys.clients(q),
    queryFn: () => listClients(q),
    placeholderData: keepPreviousData,
  });
}

export function useDrivers(q?: string) {
  return useQuery({
    queryKey: queryKeys.drivers(q),
    queryFn: () => listDrivers(q),
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// Mutações (notificação de sucesso/erro e invalidação já embutidas em useApiMutation)
// ---------------------------------------------------------------------------

export function useCreateClient() {
  return useApiMutation({
    mutationFn: (input: CreateClientInput) => createClient(input),
    successMessage: (client) => `Cliente ${client.legalName} cadastrado`,
    invalidate: [['clients']],
  });
}

export function useCreateDriver() {
  return useApiMutation({
    mutationFn: (input: CreateDriverInput) => createDriver(input),
    successMessage: (driver) => `Motorista ${driver.name} cadastrado`,
    invalidate: [['drivers']],
  });
}

export function useCreateTrip() {
  return useApiMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    successMessage: ({ trip }) => `Viagem ${formatTripCode(trip.code)} criada`,
  });
}

interface TripVariables<T> {
  tripId: string;
  input: T;
}

export function useRegisterCte() {
  return useApiMutation({
    mutationFn: ({ tripId, input }: TripVariables<RegisterCteInput>) => registerCte(tripId, input),
    successMessage: 'CT-e registrado',
  });
}

export function useUploadLoadingPhoto() {
  return useApiMutation({
    mutationFn: ({ tripId, input }: TripVariables<UploadLoadingPhotoInput>) =>
      uploadLoadingPhoto(tripId, input),
    successMessage: 'Foto do carregamento registrada',
  });
}

export function useRegisterUnloading() {
  return useApiMutation({
    mutationFn: ({ tripId, input }: TripVariables<RegisterUnloadingInput>) =>
      registerUnloading(tripId, input),
    successMessage: 'Descarga registrada',
  });
}

export function useRegisterProofs() {
  return useApiMutation({
    mutationFn: ({ tripId, input }: TripVariables<RegisterProofsInput>) =>
      registerProofs(tripId, input),
    successMessage: 'Canhoto original registrado',
  });
}

export function useCancelTrip() {
  return useApiMutation({
    mutationFn: ({ tripId, input }: TripVariables<CancelTripInput>) => cancelTrip(tripId, input),
    successMessage: 'Viagem cancelada',
  });
}

function scheduleMessage({ scheduled, rejected }: ScheduleResult): string {
  const done = `${scheduled.length} ${scheduled.length === 1 ? 'título programado' : 'títulos programados'}`;
  if (rejected.length === 0) return done;
  return `${done}; ${rejected.length} ${rejected.length === 1 ? 'recusado' : 'recusados'} (veja os motivos)`;
}

/**
 * A resposta traz `scheduled` e `rejected` (R11): quem chama deve listar os recusados com o
 * `message` de cada um. A notificação só resume as quantidades.
 */
export function useScheduleTitles() {
  return useApiMutation({
    mutationFn: (input: ScheduleTitlesInput) => scheduleTitles(input),
    successMessage: scheduleMessage,
    successColor: ({ rejected }) => (rejected.length > 0 ? 'yellow' : 'green'),
  });
}

/** Programação individual: o motivo da recusa chega como `ApiError.message` (erro 422). */
export function useScheduleTitle() {
  return useApiMutation({
    mutationFn: ({ titleId, input }: { titleId: string; input: ScheduleTitleInput }) =>
      scheduleTitle(titleId, input),
    successMessage: ({ scheduledFor }) =>
      scheduledFor
        ? `Pagamento programado para ${formatDate(scheduledFor)}`
        : 'Pagamento programado',
  });
}

export function useSettleTitle() {
  return useApiMutation({
    mutationFn: ({ titleId, input }: { titleId: string; input: SettleTitleInput }) =>
      settleTitle(titleId, input),
    successMessage: 'Baixa registrada',
  });
}
