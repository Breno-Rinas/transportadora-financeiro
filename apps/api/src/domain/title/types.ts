// Mesmos valores dos enums do Prisma; o domínio não importa o client gerado.

export type TitleNature = 'PAYABLE' | 'RECEIVABLE';

/** ADVANCE e BALANCE são pagos ao motorista; CLIENT_FREIGHT é recebido do cliente. */
export type TitleKind = 'ADVANCE' | 'BALANCE' | 'CLIENT_FREIGHT';

/** OPEN e SCHEDULED são os títulos em aberto. */
export type TitleStatus = 'OPEN' | 'SCHEDULED' | 'PAID' | 'CANCELLED';
