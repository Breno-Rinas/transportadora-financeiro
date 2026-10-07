import { api } from './client';
import type {
  Client,
  CreateClientInput,
  CreateDriverInput,
  CreateTripInput,
  Dashboard,
  DashboardQuery,
  Driver,
  RegisterCteInput,
  RegisterProofsInput,
  RegisterUnloadingInput,
  ScheduleResult,
  ScheduleTitlesInput,
  SettleTitleInput,
  TitleFilters,
  TitleListItem,
  TitleWithLocks,
  TripDetail,
  TripFilters,
  TripListItem,
  UploadLoadingPhotoInput,
} from './types';

/** Uma função por endpoint, tipada com o contrato de `types.ts`. Sem regra de negócio. */

// Cadastros
export const listClients = (q?: string) => api.get<Client[]>('/clients', { q });
export const createClient = (input: CreateClientInput) => api.post<Client>('/clients', input);

export const listDrivers = (q?: string) => api.get<Driver[]>('/drivers', { q });
export const createDriver = (input: CreateDriverInput) => api.post<Driver>('/drivers', input);

// Viagens
export const listTrips = (filters: TripFilters, signal?: AbortSignal) =>
  api.get<TripListItem[]>('/trips', { ...filters }, signal);
export const getTrip = (id: string, signal?: AbortSignal) =>
  api.get<TripDetail>(`/trips/${id}`, undefined, signal);
export const createTrip = (input: CreateTripInput) => api.post<TripDetail>('/trips', input);

export const registerCte = (tripId: string, input: RegisterCteInput) =>
  api.post<TripDetail>(`/trips/${tripId}/cte`, input);

export const uploadLoadingPhoto = (
  tripId: string,
  { file, occurredAt }: UploadLoadingPhotoInput,
) => {
  const form = new FormData();
  // `occurredAt` vai antes do arquivo: no multipart do Fastify, os campos que vêm depois de
  // `file` só ficam disponíveis após consumir o stream do arquivo.
  if (occurredAt) form.append('occurredAt', occurredAt);
  form.append('file', file);
  return api.postForm<TripDetail>(`/trips/${tripId}/loading-photo`, form);
};

export const registerUnloading = (tripId: string, input: RegisterUnloadingInput) =>
  api.post<TripDetail>(`/trips/${tripId}/unloading`, input);

export const registerProofs = (tripId: string, input: RegisterProofsInput) =>
  api.post<TripDetail>(`/trips/${tripId}/proofs`, input);

// Títulos
export const listTitles = (filters: TitleFilters, signal?: AbortSignal) =>
  api.get<TitleListItem[]>('/titles', { ...filters }, signal);

export const scheduleTitles = (input: ScheduleTitlesInput) =>
  api.post<ScheduleResult>('/titles/schedule', input);

export const settleTitle = (titleId: string, input: SettleTitleInput) =>
  api.post<TitleWithLocks>(`/titles/${titleId}/settle`, input);

// Painel
export const getDashboard = (query: DashboardQuery = {}, signal?: AbortSignal) =>
  api.get<Dashboard>('/dashboard', { ...query }, signal);
