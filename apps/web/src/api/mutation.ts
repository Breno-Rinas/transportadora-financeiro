import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { getErrorMessage } from './errors';
import { queryKeys } from './query-keys';

interface ApiMutationConfig<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Texto da notificação de sucesso (ex.: "Viagem VG-0001 criada"). */
  successMessage: string | ((data: TData, variables: TVariables) => string);
  /** Cor da notificação de sucesso (padrão `green`); `yellow` serve para sucesso parcial. */
  successColor?: (data: TData, variables: TVariables) => 'green' | 'yellow';
  /** Chaves extras a invalidar, além das que toda mutação invalida (`queryKeys.alwaysInvalidated`). */
  invalidate?: readonly QueryKey[];
}

/**
 * Helper de mutação: no sucesso, mostra notificação e invalida os dados (CLAUDE.md: toda mutação
 * invalida dashboard, trips, trip e titles); no erro, mostra `ApiError.message` do backend,
 * nunca JSON cru. O componente ainda pode passar `onSuccess`/`onError` em `mutate(vars, {...})`
 * (por exemplo, para fechar o modal ou pendurar erros no formulário).
 */
export function useApiMutation<TData, TVariables>({
  mutationFn,
  successMessage,
  successColor,
  invalidate = [],
}: ApiMutationConfig<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: (data, variables) => {
      notifications.show({
        color: successColor?.(data, variables) ?? 'green',
        message:
          typeof successMessage === 'function' ? successMessage(data, variables) : successMessage,
      });
      for (const queryKey of [...queryKeys.alwaysInvalidated, ...invalidate]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Não foi possível concluir a ação',
        message: getErrorMessage(error),
        autoClose: 8000,
      });
    },
  });
}
