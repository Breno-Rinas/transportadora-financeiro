import { IconClock, IconFileText } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import classes from './EntityCard.module.css';

export type CardAccent = 'indigo' | 'red' | 'orange' | 'green' | 'gray';

const ACCENT_CLASS: Record<CardAccent, string> = {
  indigo: classes.accentIndigo,
  red: classes.accentRed,
  orange: classes.accentOrange,
  green: classes.accentGreen,
  gray: classes.accentGray,
};

interface EntityCardProps {
  /** Nome em destaque (cliente, motorista). */
  title: ReactNode;
  /** Pill de status no canto superior direito (`TripStatusBadge`, `TitleStatusBadge`...). */
  badge?: ReactNode;
  /** Linha cinza pequena abaixo do nome (ex.: `VG-0001`). */
  code?: ReactNode;
  /** Cor da borda esquerda; indigo claro por padrão, vermelho para o que exige atenção. */
  accent?: CardAccent;
  /** Antes do nome, ex.: checkbox de seleção. */
  leading?: ReactNode;
  /** Realça o card (ex.: item selecionado). */
  selected?: boolean;
  /** Corpo: `RouteLine`, `MetaLine`, `NoteBox`. */
  children?: ReactNode;
  /** Linha de botões pequenos (`CardActions` com `CardButton`). */
  actions?: ReactNode;
  /** Botão largo da ação principal (`CardPrimaryButton`). */
  primaryAction?: ReactNode;
  /** Rodapé com links sutis (`CardFooter` com `CardFooterLink`); só quando fizer sentido. */
  footer?: ReactNode;
}

/**
 * Card do sistema: fundo branco, borda esquerda de 3 px colorida, topo com nome + badge, corpo
 * livre, linha de ações pequenas, botão principal largo e rodapé. Todas as seções são opcionais.
 */
export function EntityCard({
  title,
  badge,
  code,
  accent = 'indigo',
  leading,
  selected,
  children,
  actions,
  primaryAction,
  footer,
}: EntityCardProps) {
  const className = [classes.card, ACCENT_CLASS[accent], selected ? classes.selected : '']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={className}>
      <div className={classes.top}>
        {leading ? <div className={classes.leading}>{leading}</div> : null}
        <div className={classes.heading}>
          <h3 className={classes.title}>{title}</h3>
          {code ? <div className={classes.code}>{code}</div> : null}
        </div>
        {badge ? <div className={classes.badge}>{badge}</div> : null}
      </div>
      {children ? <div className={classes.content}>{children}</div> : null}
      {actions}
      {primaryAction ? <div className={classes.divider}>{primaryAction}</div> : null}
      {footer ? <div className={classes.divider}>{footer}</div> : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Corpo do card
// ---------------------------------------------------------------------------

interface RouteLineProps {
  origin: string;
  destination: string;
}

/** Origem (ponto verde, em negrito) e destino (ponto vermelho, em cinza). */
export function RouteLine({ origin, destination }: RouteLineProps) {
  return (
    <div className={classes.route}>
      <div className={classes.routePoint} title={origin}>
        <span className={`${classes.dot} ${classes.dotOrigin}`} aria-hidden="true" />
        <span className={classes.origin}>{origin}</span>
      </div>
      <div className={classes.routePoint} title={destination}>
        <span className={`${classes.dot} ${classes.dotDestination}`} aria-hidden="true" />
        <span className={classes.destination}>{destination}</span>
      </div>
    </div>
  );
}

interface MetaLineProps {
  /** Texto cinza à esquerda (data). */
  left: ReactNode;
  /** Ícone antes do texto da esquerda; relógio por padrão (`null` não mostra ícone). */
  icon?: ReactNode | null;
  /** À direita, em negrito (valor em reais: `Money`, `MarginBadge`). */
  right?: ReactNode;
}

/** Linha de meta: relógio + data em cinza à esquerda e valor em negrito à direita. */
export function MetaLine({ left, icon, right }: MetaLineProps) {
  return (
    <div className={classes.meta}>
      <span className={classes.metaLeft}>
        {icon === undefined ? <IconClock size={12} stroke={1.5} /> : icon}
        <span>{left}</span>
      </span>
      {right ? <span className={classes.metaRight}>{right}</span> : null}
    </div>
  );
}

export type NoteVariant = 'info' | 'warning' | 'danger' | 'success';

const NOTE_CLASS: Record<NoteVariant, string> = {
  info: classes.noteInfo,
  warning: classes.noteWarning,
  danger: classes.noteDanger,
  success: classes.noteSuccess,
};

interface NoteBoxProps {
  children: ReactNode;
  /** `info` (próximo passo), `warning` (âmbar) e `danger` (vermelho) para travas. */
  variant?: NoteVariant;
  icon?: ReactNode;
  /** Linhas antes de truncar (padrão 2). O texto completo fica no `title` quando é string. */
  lines?: number;
}

/** Caixa de nota: ícone de documento + texto de 11 px, truncado. */
export function NoteBox({ children, variant = 'info', icon, lines = 2 }: NoteBoxProps) {
  return (
    <div
      className={`${classes.note} ${NOTE_CLASS[variant]}`}
      style={{ '--note-lines': lines } as CSSProperties}
      title={typeof children === 'string' ? children : undefined}
    >
      <span className={classes.noteIcon}>{icon ?? <IconFileText size={12} stroke={1.5} />}</span>
      <span className={classes.noteText}>{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

/** Props comuns dos botões do card: com `to` vira link interno; sem, um `<button>`. */
interface CardActionProps {
  icon?: ReactNode;
  children: ReactNode;
  /** Navegação interna (react-router). */
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}

function joinClasses(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

function CardActionElement({
  className,
  icon,
  children,
  to,
  onClick,
  disabled,
  title,
}: CardActionProps & { className: string }) {
  const content = (
    <>
      {icon}
      <span>{children}</span>
    </>
  );
  if (to && !disabled) {
    return (
      <Link to={to} className={className} title={title}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} title={title}>
      {content}
    </button>
  );
}

/** Linha de botões pequenos (xs, light com borda); cada `CardButton` divide a largura. */
export function CardActions({ children }: { children: ReactNode }) {
  return <div className={classes.actions}>{children}</div>;
}

export type CardButtonTone = 'gray' | 'yellow' | 'indigo';

const TONE_CLASS: Record<CardButtonTone, string> = {
  gray: classes.toneGray,
  yellow: classes.toneYellow,
  indigo: classes.toneIndigo,
};

/** Botão pequeno da linha de ações do card. */
export function CardButton({
  tone = 'gray',
  ...props
}: CardActionProps & {
  /** `gray` (histórico), `yellow` (ação de edição/atenção) ou `indigo` (detalhes). */
  tone?: CardButtonTone;
}) {
  return (
    <CardActionElement {...props} className={joinClasses(classes.actionButton, TONE_CLASS[tone])} />
  );
}

/** Botão largo outline com ícone: a ação principal do card ("Registrar CT-e", "Dar baixa"). */
export function CardPrimaryButton(props: CardActionProps) {
  return <CardActionElement {...props} className={classes.primary} />;
}

/** Rodapé do card, com links sutis lado a lado. */
export function CardFooter({ children }: { children: ReactNode }) {
  return <div className={classes.footer}>{children}</div>;
}

/** Link sutil do rodapé: `gray` para ações neutras ("Copiar") e `red` para "Cancelar". */
export function CardFooterLink({
  tone = 'gray',
  ...props
}: CardActionProps & { tone?: 'gray' | 'red' }) {
  return (
    <CardActionElement
      {...props}
      className={joinClasses(
        classes.footerLink,
        tone === 'red' ? classes.footerRed : classes.footerGray,
      )}
    />
  );
}
