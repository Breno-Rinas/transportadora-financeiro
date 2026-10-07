import { useState } from 'react';

/**
 * Modal que age sobre um item escolhido (um título, uma viagem). O item continua guardado
 * depois de `close`, para o conteúdo não sumir durante a animação de fechamento.
 */
export function useModalTarget<T>() {
  const [state, setState] = useState<{ target: T | null; opened: boolean }>({
    target: null,
    opened: false,
  });

  return {
    target: state.target,
    opened: state.opened,
    open: (target: T) => setState({ target, opened: true }),
    close: () => setState((previous) => ({ ...previous, opened: false })),
  };
}
