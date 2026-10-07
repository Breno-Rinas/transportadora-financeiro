import type { ReactNode } from 'react';
import classes from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  /** Linha pequena abaixo do título (ex.: data de hoje). */
  subtitle?: ReactNode;
  /** Slot à direita: busca, filtros e o botão da ação principal da tela. */
  children?: ReactNode;
}

/** Cabeçalho das telas: título (20 px, peso 700) à esquerda e o slot de busca/filtros à direita. */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className={classes.root}>
      <div className={classes.titles}>
        <h1 className={classes.title}>{title}</h1>
        {subtitle ? <p className={classes.subtitle}>{subtitle}</p> : null}
      </div>
      {children ? <div className={classes.side}>{children}</div> : null}
    </header>
  );
}
