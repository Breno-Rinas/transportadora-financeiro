import { Skeleton } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { TitleListItem } from '../../api/types';
import {
  BucketBadge,
  EmptyState,
  ErrorState,
  LockReasonBadges,
  Money,
  TitleStatusBadge,
} from '../../components';
import { formatDate, formatTripCode } from '../../lib/format';
import { TITLE_KIND_LABEL } from '../../lib/labels';
import { paths } from '../../lib/routes';
import classes from './ActionList.module.css';

const MAX_ROWS = 6;

interface ActionListProps {
  title: string;
  items: readonly TitleListItem[];
  loading: boolean;
  error: unknown;
  /** Há erro de carregamento (o `error` pode ser qualquer valor). */
  failed: boolean;
  onRetry: () => void;
  /** Destino de "Ver todos" (a tela Financeiro com o filtro). */
  seeAllTo: string;
  emptyTitle: string;
  emptyDescription: ReactNode;
  /** Cor da contagem no cabeçalho. */
  countTone?: 'neutral' | 'danger' | 'warning';
  /** Mostra os motivos da trava em cada linha. */
  showLockReasons?: boolean;
}

const COUNT_CLASS = {
  neutral: '',
  danger: classes.countDanger,
  warning: classes.countWarning,
} as const;

function RowsSkeleton() {
  return (
    <div className={classes.rows} aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((row) => (
        <div key={row} className={classes.skeletonRow}>
          <Skeleton height={12} width="45%" radius="sm" />
          <Skeleton height={10} width="70%" radius="sm" />
        </div>
      ))}
    </div>
  );
}

function ActionRow({ item, showLockReasons }: { item: TitleListItem; showLockReasons: boolean }) {
  const { trip } = item;
  return (
    <Link to={paths.trip(trip.id)} className={classes.row}>
      <div className={classes.line}>
        <div className={classes.who}>
          <div className={classes.name}>{trip.driver.name}</div>
          <div className={classes.sub}>
            {formatTripCode(trip.code)} · {TITLE_KIND_LABEL[item.kind]} · {trip.origin} →{' '}
            {trip.destination}
          </div>
        </div>
        <div className={classes.amount}>
          <Money cents={item.amountCents} />
          <span className={classes.date}>{formatDate(item.effectiveDate)}</span>
        </div>
      </div>
      <div className={classes.tags}>
        {item.bucket ? <BucketBadge bucket={item.bucket} size="xs" /> : null}
        {item.status === 'SCHEDULED' ? <TitleStatusBadge status={item.status} size="xs" /> : null}
        {showLockReasons ? <LockReasonBadges reasons={item.locks.reasons} /> : null}
      </div>
    </Link>
  );
}

/** Lista curta de ação do painel: títulos que pedem atenção, com link para o Financeiro. */
export function ActionList({
  title,
  items,
  loading,
  error,
  failed,
  onRetry,
  seeAllTo,
  emptyTitle,
  emptyDescription,
  countTone = 'neutral',
  showLockReasons = false,
}: ActionListProps) {
  const visible = items.slice(0, MAX_ROWS);
  const hidden = items.length - visible.length;

  function renderBody() {
    if (loading) return <RowsSkeleton />;
    if (failed) {
      return (
        <ErrorState compact error={error} onRetry={onRetry} title="Não foi possível carregar" />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          compact
          icon={<IconCircleCheck size={18} stroke={1.5} />}
          title={emptyTitle}
          description={emptyDescription}
        />
      );
    }
    return (
      <>
        <div className={classes.rows}>
          {visible.map((item) => (
            <ActionRow key={item.id} item={item} showLockReasons={showLockReasons} />
          ))}
        </div>
        {hidden > 0 ? (
          <div className={classes.more}>
            + {hidden} {hidden === 1 ? 'outro título' : 'outros títulos'} no Financeiro
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section className={classes.card}>
      <div className={classes.header}>
        <div className={classes.heading}>
          <h2 className={classes.title}>{title}</h2>
          {!loading && !failed ? (
            <span className={`${classes.count} ${items.length > 0 ? COUNT_CLASS[countTone] : ''}`}>
              {items.length}
            </span>
          ) : null}
        </div>
        <Link to={seeAllTo} className={classes.seeAll}>
          Ver no Financeiro
        </Link>
      </div>
      {renderBody()}
    </section>
  );
}
