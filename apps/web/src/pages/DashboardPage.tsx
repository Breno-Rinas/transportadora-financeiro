import { Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCalendarWeek,
  IconCoins,
  IconLock,
  IconTrendingUp,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useDashboard, useTitles } from '../api/hooks';
import type { Dashboard, TitleListItem } from '../api/types';
import { ErrorState, KpiCard, Money, PageHeader } from '../components';
import { formatBRL, formatPercent } from '../lib/format';
import { financePath, tripsPath } from '../lib/routes';
import { ActionList } from './dashboard/ActionList';
import classes from './dashboard/Dashboard.module.css';

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function KpiRowSkeleton() {
  return (
    <div className={classes.kpis} aria-busy="true" aria-label="Carregando indicadores">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          style={{
            height: 82,
            borderRadius: 8,
            border: '1px solid var(--fb-border)',
            borderLeft: '3px solid var(--fb-indigo-accent)',
            background: 'var(--fb-surface)',
          }}
        />
      ))}
    </div>
  );
}

function KpiRow({ dashboard }: { dashboard: Dashboard }) {
  const {
    payableOverdue,
    payableDueToday,
    payableDueWeek,
    receivableOpen,
    lockedBalances,
    margin,
  } = dashboard;

  return (
    <div className={classes.kpis}>
      <KpiCard
        tone="red"
        label="Vencidos"
        icon={<IconAlertTriangle size={12} stroke={1.8} />}
        value={formatBRL(payableOverdue.totalCents)}
        detail={`${pluralize(payableOverdue.count, 'título', 'títulos')} a pagar`}
        to={financePath({ nature: 'PAYABLE', bucket: 'OVERDUE' })}
        muted={payableOverdue.count === 0}
      />
      <KpiCard
        tone="indigo"
        label="Vencendo hoje"
        icon={<IconCalendarEvent size={12} stroke={1.8} />}
        value={formatBRL(payableDueToday.totalCents)}
        detail={`${pluralize(payableDueToday.count, 'título', 'títulos')} a pagar`}
        to={financePath({ nature: 'PAYABLE', bucket: 'TODAY' })}
        muted={payableDueToday.count === 0}
      />
      <KpiCard
        label="Próximos 7 dias"
        icon={<IconCalendarWeek size={12} stroke={1.8} />}
        value={formatBRL(payableDueWeek.totalCents)}
        detail={`${pluralize(payableDueWeek.count, 'título', 'títulos')} · inclui hoje`}
        to={financePath({ nature: 'PAYABLE' })}
      />
      <KpiCard
        accent="green"
        label="A receber em aberto"
        icon={<IconCoins size={12} stroke={1.8} />}
        value={formatBRL(receivableOpen.totalCents)}
        detail={
          <>
            {pluralize(receivableOpen.count, 'título', 'títulos')}
            {receivableOpen.overdueCount > 0 ? (
              <>
                {' · '}
                <Text span inherit c="red.7" fw={500}>
                  {pluralize(receivableOpen.overdueCount, 'vencido', 'vencidos')}
                </Text>
              </>
            ) : null}
          </>
        }
        to={financePath({ nature: 'RECEIVABLE' })}
      />
      <KpiCard
        accent="orange"
        label="Saldos travados"
        icon={<IconLock size={12} stroke={1.8} />}
        value={formatBRL(lockedBalances.totalCents)}
        detail={`${pluralize(lockedBalances.count, 'saldo', 'saldos')} a pagar`}
        to={financePath({ nature: 'PAYABLE', kind: 'BALANCE', locked: true })}
        muted={lockedBalances.count === 0}
      />
      <KpiCard
        accent={margin.amountCents < 0 ? 'red' : 'green'}
        label="Margem do mês"
        icon={<IconTrendingUp size={12} stroke={1.8} />}
        value={<Money cents={margin.amountCents} />}
        detail={
          <>
            <Text span inherit c={margin.amountCents < 0 ? 'red.7' : undefined} fw={500}>
              {formatPercent(margin.percent)}
            </Text>{' '}
            · realizada
          </>
        }
        to={tripsPath({ from: dashboard.period.from, to: dashboard.period.to })}
      />
    </div>
  );
}

function isDueNow(item: TitleListItem): boolean {
  return item.bucket === 'OVERDUE' || item.bucket === 'TODAY';
}

function byEffectiveDate(a: TitleListItem, b: TitleListItem): number {
  return (a.effectiveDate ?? '').localeCompare(b.effectiveDate ?? '');
}

export function DashboardPage() {
  const dashboard = useDashboard();
  // Em aberto = OPEN ou SCHEDULED; a faixa (`bucket`) vem pronta da API.
  const openTitles = useTitles({ nature: 'PAYABLE', status: 'OPEN' });
  const scheduledTitles = useTitles({ nature: 'PAYABLE', status: 'SCHEDULED' });
  const lockedTitles = useTitles({ nature: 'PAYABLE', kind: 'BALANCE', locked: true });

  const payments = [...(openTitles.data ?? []), ...(scheduledTitles.data ?? [])]
    .filter(isDueNow)
    .sort(byEffectiveDate);
  const locked = (lockedTitles.data ?? []).filter((item) => item.bucket !== null);

  function retryPayments() {
    void openTitles.refetch();
    void scheduledTitles.refetch();
  }

  return (
    <>
      <PageHeader
        title="Painel"
        subtitle={
          dashboard.data ? `Hoje, ${dayjs(dashboard.data.today).format('dddd, DD/MM/YYYY')}` : null
        }
      />

      {dashboard.isPending ? <KpiRowSkeleton /> : null}
      {dashboard.isError ? (
        <div style={{ marginBottom: 20 }}>
          <ErrorState
            title="Não foi possível carregar os indicadores"
            error={dashboard.error}
            onRetry={() => void dashboard.refetch()}
            retrying={dashboard.isRefetching}
          />
        </div>
      ) : null}
      {dashboard.data ? <KpiRow dashboard={dashboard.data} /> : null}

      <div className={classes.lists}>
        <ActionList
          title="Pagamentos de hoje e vencidos"
          items={payments}
          loading={openTitles.isPending || scheduledTitles.isPending}
          failed={openTitles.isError || scheduledTitles.isError}
          error={openTitles.error ?? scheduledTitles.error}
          onRetry={retryPayments}
          seeAllTo={financePath({ nature: 'PAYABLE' })}
          emptyTitle="Nada vence hoje nem está vencido"
          emptyDescription="Quando houver pagamentos para hoje ou em atraso, eles aparecem aqui."
          countTone={payments.length > 0 ? 'danger' : 'neutral'}
        />
        <ActionList
          title="Saldos travados"
          items={locked}
          loading={lockedTitles.isPending}
          failed={lockedTitles.isError}
          error={lockedTitles.error}
          onRetry={() => void lockedTitles.refetch()}
          seeAllTo={financePath({ nature: 'PAYABLE', kind: 'BALANCE', locked: true })}
          emptyTitle="Nenhum saldo travado"
          emptyDescription="Saldos aguardando descarga ou canhoto original aparecem aqui, com o motivo."
          countTone="warning"
          showLockReasons
        />
      </div>
    </>
  );
}
