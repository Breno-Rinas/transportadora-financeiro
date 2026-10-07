import { Button, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import { useClients } from '../api/hooks';
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  TableSkeleton,
} from '../components';
import { formatInstantDate, maskCnpj } from '../lib/format';
import { useSearchQuery } from '../lib/use-search-query';
import { ClientModal } from './registrations/ClientModal';

function formatTerm(days: number): string {
  if (days === 0) return 'À vista';
  return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

export function ClientsPage() {
  const { search, setSearch, query } = useSearchQuery();
  const [modalOpened, modal] = useDisclosure(false);
  const clients = useClients(query);

  function renderContent() {
    if (clients.isPending) return <TableSkeleton columns={4} />;
    if (clients.isError) {
      return (
        <ErrorState
          title="Não foi possível carregar os clientes"
          error={clients.error}
          onRetry={() => void clients.refetch()}
          retrying={clients.isRefetching}
        />
      );
    }
    if (clients.data.length === 0) {
      return query ? (
        <EmptyState
          icon={<IconUsers size={18} stroke={1.5} />}
          title="Nenhum cliente encontrado"
          description="Nenhum cliente combina com a busca. Confira o nome ou o CNPJ."
          action={
            <Button size="xs" variant="default" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={<IconUsers size={18} stroke={1.5} />}
          title="Nenhum cliente cadastrado"
          description="Cadastre o primeiro cliente para poder criar viagens. Clique em Novo cliente."
          action={
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={modal.open}>
              Novo cliente
            </Button>
          }
        />
      );
    }
    return (
      <DataTable>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Razão social</Table.Th>
            <Table.Th>CNPJ</Table.Th>
            <Table.Th>Prazo de pagamento</Table.Th>
            <Table.Th>Cadastrado em</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {clients.data.map((client) => (
            <Table.Tr key={client.id}>
              <Table.Td fw={500}>{client.legalName}</Table.Td>
              <Table.Td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {maskCnpj(client.cnpj)}
              </Table.Td>
              <Table.Td>{formatTerm(client.paymentTermDays)}</Table.Td>
              <Table.Td c="dimmed">{formatInstantDate(client.createdAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </DataTable>
    );
  }

  return (
    <>
      <PageHeader title="Clientes">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Razão social ou CNPJ…"
          aria-label="Buscar clientes"
        />
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={modal.open}>
          Novo cliente
        </Button>
      </PageHeader>
      {renderContent()}
      <ClientModal opened={modalOpened} onClose={modal.close} />
    </>
  );
}
