import { Button, Skeleton } from '@mantine/core';
import { IconAlertTriangle, IconInbox, IconRefresh } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { getErrorMessage } from '../api/errors';
import classes from './States.module.css';

interface EmptyStateProps {
  title: string;
  /** Orientação do que fazer (ex.: "Clique em Nova viagem para começar."). */
  description?: ReactNode;
  icon?: ReactNode;
  /** Botão ou link da ação sugerida. */
  action?: ReactNode;
  /** Versão sem margens, para dentro de listas e cards. */
  compact?: boolean;
}

/** Lista vazia: caixa tracejada com o que fazer a seguir. */
export function EmptyState({ title, description, icon, action, compact }: EmptyStateProps) {
  return (
    <div className={`${classes.state} ${compact ? classes.compact : ''}`}>
      <div className={classes.icon}>{icon ?? <IconInbox size={18} stroke={1.5} />}</div>
      <p className={classes.title}>{title}</p>
      {description ? <p className={classes.description}>{description}</p> : null}
      {action ? <div className={classes.action}>{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  /** Erro da consulta; vira a mensagem de negócio (nunca JSON cru). */
  error: unknown;
  /** Normalmente `query.refetch`. */
  onRetry: () => void;
  title?: string;
  /** Enquanto repete a consulta. */
  retrying?: boolean;
  compact?: boolean;
}

/** Erro de carregamento: mensagem do backend e botão "Tentar de novo". */
export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
  retrying,
  compact,
}: ErrorStateProps) {
  return (
    <div className={`${classes.state} ${compact ? classes.compact : ''}`} role="alert">
      <div className={`${classes.icon} ${classes.iconError}`}>
        <IconAlertTriangle size={18} stroke={1.5} />
      </div>
      <p className={classes.title}>{title}</p>
      <p className={classes.description}>{getErrorMessage(error)}</p>
      <div className={classes.action}>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconRefresh size={14} stroke={1.5} />}
          loading={retrying}
          onClick={onRetry}
        >
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}

/** Esqueleto do quadro: colunas com alguns cards cinza, no mesmo formato do quadro real. */
export function BoardSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className={classes.skeletonBoard} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className={classes.skeletonColumn}>
          <Skeleton height={16} width="55%" radius="sm" />
          {Array.from({ length: column % 2 === 0 ? 2 : 1 }, (_, card) => (
            <div key={card} className={classes.skeletonCard}>
              <Skeleton height={13} width="70%" radius="sm" />
              <Skeleton height={10} width="35%" radius="sm" />
              <Skeleton height={11} width="60%" radius="sm" />
              <Skeleton height={11} width="50%" radius="sm" />
              <Skeleton height={34} radius="md" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de tabela: linhas com células cinza. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className={classes.skeletonTable} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className={classes.skeletonRow}>
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} height={12} radius="sm" style={{ flex: column === 0 ? 2 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
