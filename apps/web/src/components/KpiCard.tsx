import type { ReactNode } from 'react';
import { Link } from 'react-router';
import classes from './KpiCard.module.css';

export type KpiTone = 'neutral' | 'red' | 'indigo';
export type KpiAccent = 'indigo' | 'green' | 'orange' | 'red';

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: '',
  red: classes.toneRed,
  indigo: classes.toneIndigo,
};

const ACCENT_CLASS: Record<KpiAccent, string> = {
  indigo: '',
  green: classes.accentGreen,
  orange: classes.accentOrange,
  red: classes.accentRed,
};

interface KpiCardProps {
  label: string;
  icon: ReactNode;
  /** Valor principal já formatado (`formatBRL`). */
  value: ReactNode;
  /** Linha de apoio (quantidade de títulos, percentual). */
  detail?: ReactNode;
  /** Destino do clique: `/financeiro` ou `/viagens` com o filtro na querystring. */
  to: string;
  /** `red` e `indigo` são os destaques fortes (vencidos e vencendo hoje). */
  tone?: KpiTone;
  /** Cor da borda esquerda nos cards neutros. */
  accent?: KpiAccent;
  /** Esmaece o valor (nada a fazer). */
  muted?: boolean;
}

/** KPI do painel no estilo de card do sistema; o card inteiro é um link para o filtro. */
export function KpiCard({
  label,
  icon,
  value,
  detail,
  to,
  tone = 'neutral',
  accent = 'indigo',
  muted,
}: KpiCardProps) {
  return (
    <Link to={to} className={`${classes.kpi} ${TONE_CLASS[tone]} ${ACCENT_CLASS[accent]}`}>
      <span className={classes.label}>
        {icon}
        {label}
      </span>
      <span className={`${classes.value} ${muted ? classes.muted : ''}`}>{value}</span>
      {detail ? <span className={classes.detail}>{detail}</span> : null}
    </Link>
  );
}
