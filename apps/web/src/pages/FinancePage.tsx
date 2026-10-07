import { Button, Checkbox, Tabs } from '@mantine/core';
import { IconCalendarEvent, IconDownload, IconReceipt2 } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { titlesCsvUrl } from '../api/endpoints';
import { useDashboard, useTitles } from '../api/hooks';
import type { TitleKind, TitleNature } from '../api/types';
import {
  Board,
  BoardColumn,
  BoardSkeleton,
  EmptyState,
  ErrorState,
  FilterSelect,
  PageHeader,
  SearchInput,
} from '../components';
import { todayLocalDate } from '../lib/format';
import { TITLE_KIND_LABEL, TITLE_KIND_ORDER, TITLE_NATURE_LABEL } from '../lib/labels';
import { paths } from '../lib/routes';
import { useModalTarget } from '../lib/use-modal-target';
import { buildFinanceColumns } from './finance/columns';
import { FinanceTitleCard } from './finance/FinanceTitleCard';
import classes from './finance/Finance.module.css';
import { matchesSearch } from './finance/search';
import { useFinanceFilters } from './finance/use-finance-filters';
import { ScheduleBatchModal } from './titles/ScheduleBatchModal';
import { ScheduleTitleModal } from './titles/ScheduleTitleModal';
import { SettleTitleModal } from './titles/SettleTitleModal';
import type { TitleTarget } from './titles/title-target';

const KIND_OPTIONS = TITLE_KIND_ORDER.map((kind) => ({
  value: kind,
  label: TITLE_KIND_LABEL[kind],
}));
const NATURES: readonly TitleNature[] = ['PAYABLE', 'RECEIVABLE'];

export function FinancePage() {
  const { nature, kind, locked, bucket, search, filters, hasFilters, setFilters, clearFilters } =
    useFinanceFilters();
  const titles = useTitles(filters);
  const dashboard = useDashboard();
  const today = dashboard.data?.today ?? todayLocalDate();

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [batchOpened, setBatchOpened] = useState(false);
  const schedule = useModalTarget<TitleTarget>();
  const settle = useModalTarget<TitleTarget>();

  // O quadro mostra os títulos em aberto: só eles têm faixa (`bucket`) na API.
  const items = (titles.data ?? []).filter(
    (item) => item.bucket !== null && matchesSearch(item, search),
  );
  const selectable = nature === 'PAYABLE';
  const selectedItems = selectable ? items.filter((item) => selectedIds.has(item.id)) : [];
  const columns = buildFinanceColumns(items, today);

  // `?bucket=` rola o quadro até a coluna uma vez por combinação de aba e faixa.
  const scrolledTo = useRef<string | null>(null);
  const boardReady = titles.isSuccess && items.length > 0;
  useEffect(() => {
    if (!bucket || !boardReady) return;
    const scrollKey = `${nature}:${bucket}`;
    if (scrolledTo.current === scrollKey) return;
    scrolledTo.current = scrollKey;
    const first = columns.find((column) => column.bucket === bucket);
    document
      .getElementById(`finance-col-${first?.key}`)
      ?.scrollIntoView({ behavior: 'auto', inline: 'start', block: 'nearest' });
  });

  function toggle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeNature(value: string | null) {
    setSelectedIds(new Set());
    setFilters({ nature: value === 'RECEIVABLE' ? 'RECEIVABLE' : null });
  }

  function deselect(ids: readonly string[]) {
    setSelectedIds((previous) => new Set([...previous].filter((id) => !ids.includes(id))));
  }

  function renderContent() {
    if (titles.isPending) return <BoardSkeleton columns={5} />;
    if (titles.isError && !titles.data) {
      return (
        <ErrorState
          title="Não foi possível carregar os títulos"
          error={titles.error}
          onRetry={() => void titles.refetch()}
          retrying={titles.isRefetching}
        />
      );
    }
    if (items.length === 0) {
      return hasFilters ? (
        <EmptyState
          icon={<IconReceipt2 size={18} stroke={1.5} />}
          title="Nenhum título encontrado"
          description="Nenhum título em aberto combina com os filtros. Ajuste a busca ou limpe os filtros."
          action={
            <Button size="xs" variant="default" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<IconReceipt2 size={18} stroke={1.5} />}
          title={
            nature === 'PAYABLE' ? 'Nenhum pagamento em aberto' : 'Nenhum valor a receber em aberto'
          }
          description="Os títulos nascem quando uma viagem tem o CT-e e a foto do carregamento registrados. Abra uma viagem para registrá-los."
          action={
            <Button component={Link} to={paths.trips} size="xs" variant="default">
              Ver viagens
            </Button>
          }
        />
      );
    }

    return (
      <div style={{ opacity: titles.isPlaceholderData ? 0.6 : 1, transition: 'opacity 120ms' }}>
        <Board label={`Títulos ${TITLE_NATURE_LABEL[nature].toLowerCase()} por data efetiva`}>
          {columns.map((column) => (
            <BoardColumn
              key={column.key}
              id={`finance-col-${column.key}`}
              focused={bucket === column.bucket}
              label={column.label}
              eyebrow={column.eyebrow}
              tone={column.tone}
              count={column.items.length}
              emptyText="Sem títulos"
              width={248}
            >
              {column.items.map((item) => (
                <FinanceTitleCard
                  key={item.id}
                  item={item}
                  selectable={selectable}
                  selected={selectedIds.has(item.id)}
                  onToggle={toggle}
                  onSchedule={schedule.open}
                  onSettle={settle.open}
                />
              ))}
            </BoardColumn>
          ))}
        </Board>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <PageHeader title="Contas a pagar e receber">
        <Tabs value={nature} onChange={changeNature} variant="pills" radius="md">
          <Tabs.List>
            {NATURES.map((value) => (
              <Tabs.Tab key={value} value={value} fz="sm" py={6}>
                {TITLE_NATURE_LABEL[value]}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <SearchInput
          value={search}
          onChange={(value) => setFilters({ q: value })}
          placeholder="Nome, viagem ou rota…"
          aria-label="Buscar títulos"
          w={190}
        />
        <FilterSelect
          placeholder="Todas as espécies"
          aria-label="Filtrar por espécie"
          data={KIND_OPTIONS}
          value={kind ?? null}
          onChange={(value) => setFilters({ kind: value as TitleKind | null })}
          w={190}
        />
        <Checkbox
          size="xs"
          label="Só travados"
          checked={locked}
          onChange={(event) => setFilters({ locked: event.currentTarget.checked ? 'true' : null })}
        />
        <Button
          component="a"
          href={titlesCsvUrl(filters)}
          download="titulos.csv"
          variant="default"
          size="sm"
          leftSection={<IconDownload size={14} stroke={1.5} />}
          title="Baixa os títulos desta aba com os filtros de espécie e travas (inclusive os já pagos)"
        >
          Exportar CSV
        </Button>
      </PageHeader>

      {renderContent()}

      {selectedItems.length > 0 ? (
        <div className={classes.selectionBar} role="region" aria-label="Títulos selecionados">
          <span className={classes.selectionText}>
            {selectedItems.length === 1
              ? '1 título selecionado'
              : `${selectedItems.length} títulos selecionados`}
          </span>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
          <Button
            size="sm"
            leftSection={<IconCalendarEvent size={14} stroke={1.5} />}
            onClick={() => setBatchOpened(true)}
          >
            Programar selecionados ({selectedItems.length})
          </Button>
        </div>
      ) : null}

      <ScheduleBatchModal
        titles={selectedItems}
        opened={batchOpened}
        onClose={() => setBatchOpened(false)}
        onScheduled={deselect}
      />
      <ScheduleTitleModal
        target={schedule.target}
        opened={schedule.opened}
        onClose={schedule.close}
      />
      <SettleTitleModal target={settle.target} opened={settle.opened} onClose={settle.close} />
    </div>
  );
}
