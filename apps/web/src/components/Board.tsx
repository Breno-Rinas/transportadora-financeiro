import { IconCube } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';
import classes from './Board.module.css';

interface BoardProps {
  children: ReactNode;
  /** Descrição do quadro para leitores de tela (ex.: "Viagens por status"). */
  label?: string;
}

/** Quadro de colunas lado a lado, com rolagem horizontal (padrão das telas de lista). */
export function Board({ children, label }: BoardProps) {
  return (
    <div className={classes.board} role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export type BoardColumnTone = 'default' | 'indigo' | 'red';

interface BoardColumnProps {
  /** Âncora da coluna (ex.: para rolar até ela). */
  id?: string;
  /** Contorno indigo: a coluna que a navegação (querystring) quer mostrar. */
  focused?: boolean;
  label: string;
  count: number;
  /**
   * `indigo` e `red` são colunas em destaque (ex.: "Hoje" e "Vencidos"): fundo colorido, rótulo
   * colorido e contagem num círculo cheio.
   */
  tone?: BoardColumnTone;
  /** Sobretítulo em maiúsculas pequenas, usado nas colunas em destaque (ex.: "Hoje"). */
  eyebrow?: string;
  /** Texto do estado vazio tracejado, mostrado quando `count` é 0 (ex.: "Sem viagens"). */
  emptyText?: string;
  /** Largura da coluna em px (padrão 248). */
  width?: number;
  children?: ReactNode;
}

const COLUMN_TONE_CLASS: Record<BoardColumnTone, string> = {
  default: '',
  indigo: classes.columnIndigo,
  red: classes.columnRed,
};

const LABEL_TONE_CLASS: Record<BoardColumnTone, string> = {
  default: '',
  indigo: classes.labelIndigo,
  red: classes.labelRed,
};

const EYEBROW_TONE_CLASS: Record<BoardColumnTone, string> = {
  default: '',
  indigo: classes.eyebrowIndigo,
  red: classes.eyebrowRed,
};

const COUNT_TONE_CLASS: Record<BoardColumnTone, string> = {
  default: '',
  indigo: classes.countIndigo,
  red: classes.countRed,
};

/** Coluna do quadro: cabeçalho com rótulo e contagem, cards em rolagem vertical e estado vazio. */
export function BoardColumn({
  id,
  focused,
  label,
  count,
  tone = 'default',
  eyebrow,
  emptyText = 'Sem itens',
  width,
  children,
}: BoardColumnProps) {
  const highlighted = tone !== 'default';
  const style = width ? ({ '--board-column-width': `${width}px` } as CSSProperties) : undefined;

  return (
    <section
      id={id}
      className={`${classes.column} ${COLUMN_TONE_CLASS[tone]} ${focused ? classes.columnFocused : ''}`}
      style={style}
      aria-label={`${label}: ${count}`}
    >
      <div className={`${classes.header} ${highlighted ? classes.headerHighlight : ''}`}>
        <div className={classes.heading}>
          {eyebrow ? (
            <span className={`${classes.eyebrow} ${EYEBROW_TONE_CLASS[tone]}`}>{eyebrow}</span>
          ) : null}
          <span className={`${classes.label} ${LABEL_TONE_CLASS[tone]}`}>{label}</span>
        </div>
        <span className={`${classes.count} ${COUNT_TONE_CLASS[tone]}`}>{count}</span>
      </div>
      {count === 0 ? (
        <div className={classes.empty}>
          <IconCube size={20} stroke={1.3} />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className={classes.body}>{children}</div>
      )}
    </section>
  );
}
