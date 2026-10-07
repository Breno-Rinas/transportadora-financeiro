// Mesmos valores dos enums do Prisma; o domínio não importa o client gerado.

export type TitleNature = 'PAYABLE' | 'RECEIVABLE';

/**
 * ADVANCE e BALANCE são pagos ao motorista; CLIENT_FREIGHT é recebido do cliente;
 * ADVANCE_RECOVERY é o adiantamento pago a receber de volta do motorista na viagem cancelada (R13).
 */
export type TitleKind = 'ADVANCE' | 'BALANCE' | 'CLIENT_FREIGHT' | 'ADVANCE_RECOVERY';

/** OPEN e SCHEDULED são os títulos em aberto. */
export type TitleStatus = 'OPEN' | 'SCHEDULED' | 'PAID' | 'CANCELLED';
