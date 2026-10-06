import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

const MAX_RETRIES = 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 10_000,
      // Erro 4xx é resposta definitiva do backend: repetir não adianta.
      retry: (failureCount, error) =>
        failureCount < MAX_RETRIES &&
        !(error instanceof ApiError && error.status < 500 && error.status > 0),
    },
  },
});
