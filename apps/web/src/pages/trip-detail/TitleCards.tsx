import { IconCalendarEvent, IconCash, IconReceipt2 } from '@tabler/icons-react';
import type { TitleWithLocks, TripDetail } from '../../api/types';
import {
  CardActions,
  CardButton,
  EmptyState,
  EntityCard,
  LockReasonBadges,
  MetaLine,
  Money,
  NoteBox,
  TitleStatusBadge,
  type CardAccent,
} from '../../components';
import { formatDate } from '../../lib/format';
import {
  TITLE_COUNTERPARTY,
  TITLE_KIND_LABEL,
  TITLE_KIND_ORDER,
  TITLE_NATURE_LABEL,
} from '../../lib/labels';
import type { TitleTarget } from '../titles/title-target';
import { isOpenTitle } from './helpers';
import classes from './TripDetail.module.css';

function accentFor(title: TitleWithLocks): CardAccent {
  if (title.status === 'PAID') return 'green';
  if (title.status === 'CANCELLED') return 'gray';
  return title.locks.reasons.length > 0 ? 'orange' : 'indigo';
}

/** "Vence em 05/11/2026", "Programado para 07/10/2026"... a data que importa para o título. */
function dateText(title: TitleWithLocks): string {
  if (title.status === 'PAID' && title.payment) {
    return `${title.nature === 'RECEIVABLE' ? 'Recebido' : 'Pago'} em ${formatDate(title.payment.paidOn)}`;
  }
  if (title.status === 'CANCELLED') return 'Cancelado com a viagem';
  if (title.scheduledFor) return `Programado para ${formatDate(title.scheduledFor)}`;
  if (title.dueDate) return `Vence em ${formatDate(title.dueDate)}`;
  return 'Sem vencimento ainda';
}

interface TitleCardProps {
  title: TitleWithLocks;
  counterparty: string;
  tripCode: number;
  onSchedule: (target: TitleTarget) => void;
  onSettle: (target: TitleTarget) => void;
}

function TitleCard({ title, counterparty, tripCode, onSchedule, onSettle }: TitleCardProps) {
  const open = isOpenTitle(title);
  const target: TitleTarget = {
    id: title.id,
    nature: title.nature,
    kind: title.kind,
    amountCents: title.amountCents,
    tripCode,
  };
  // Só o a pagar é programado; a baixa vale para qualquer título em aberto.
  const canSchedule = open && title.nature === 'PAYABLE';

  return (
    <EntityCard
      accent={accentFor(title)}
      title={TITLE_KIND_LABEL[title.kind]}
      badge={<TitleStatusBadge status={title.status} nature={title.nature} />}
      code={`${TITLE_NATURE_LABEL[title.nature]} · ${counterparty}`}
      actions={
        open ? (
          <CardActions>
            {canSchedule ? (
              <CardButton
                tone="yellow"
                icon={<IconCalendarEvent size={13} stroke={1.5} />}
                onClick={() => onSchedule(target)}
              >
                Programar
              </CardButton>
            ) : null}
            <CardButton
              tone="indigo"
              icon={<IconCash size={13} stroke={1.5} />}
              onClick={() => onSettle(target)}
            >
              Dar baixa
            </CardButton>
          </CardActions>
        ) : undefined
      }
    >
      <MetaLine
        icon={<IconCalendarEvent size={12} stroke={1.5} />}
        left={dateText(title)}
        right={<Money cents={title.amountCents} />}
      />
      {open && title.scheduledFor && title.dueDate ? (
        <MetaLine icon={null} left={`Vencimento original: ${formatDate(title.dueDate)}`} />
      ) : null}
      {open && title.locks.reasons.length > 0 ? (
        <div className={classes.lockBadges}>
          <LockReasonBadges reasons={title.locks.reasons} />
        </div>
      ) : null}
      {title.status === 'CANCELLED' ? (
        <NoteBox variant="warning">Título cancelado: não será pago nem recebido.</NoteBox>
      ) : null}
    </EntityCard>
  );
}

interface TitleCardsProps {
  detail: TripDetail;
  onSchedule: (target: TitleTarget) => void;
  onSettle: (target: TitleTarget) => void;
}

/** Títulos da viagem em cards: espécie, valor, data, status, travas e as ações Programar e Dar baixa. */
export function TitleCards({ detail, onSchedule, onSettle }: TitleCardsProps) {
  const { driver, client, trip } = detail;
  const titles = [...detail.titles].sort(
    (a, b) => TITLE_KIND_ORDER.indexOf(a.kind) - TITLE_KIND_ORDER.indexOf(b.kind),
  );

  return (
    <section className={classes.section} aria-label="Títulos da viagem">
      <h2 className={classes.sectionTitle}>
        Títulos
        <span className={classes.sectionCount}>{titles.length}</span>
      </h2>
      {titles.length === 0 ? (
        <EmptyState
          compact
          icon={<IconReceipt2 size={18} stroke={1.5} />}
          title="Nenhum título gerado ainda"
          description="O adiantamento, o saldo e o frete do cliente são gerados quando o CT-e e a foto do carregamento estiverem registrados."
        />
      ) : (
        <div className={classes.titles}>
          {titles.map((title) => (
            <TitleCard
              key={title.id}
              title={title}
              counterparty={
                TITLE_COUNTERPARTY[title.kind] === 'CLIENT' ? client.legalName : driver.name
              }
              tripCode={trip.code}
              onSchedule={onSchedule}
              onSettle={onSettle}
            />
          ))}
        </div>
      )}
    </section>
  );
}
