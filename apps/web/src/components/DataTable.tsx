import { Table, type TableProps } from '@mantine/core';
import classes from './DataTable.module.css';

/**
 * Tabela no estilo do sistema: cartão branco com borda, cabeçalho em maiúsculas pequenas e linhas
 * de 13 px. Use com `Table.Thead`, `Table.Tbody`, `Table.Tr`, `Table.Th` e `Table.Td` do Mantine.
 */
export function DataTable({ children, ...rest }: TableProps) {
  return (
    <div className={`${classes.wrapper} fb-scroll`}>
      <Table className={classes.table} highlightOnHover verticalSpacing={0} {...rest}>
        {children}
      </Table>
    </div>
  );
}
