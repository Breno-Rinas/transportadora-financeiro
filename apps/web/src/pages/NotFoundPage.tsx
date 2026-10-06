import { Anchor } from '@mantine/core';
import { Link } from 'react-router';
import { PagePlaceholder } from './PagePlaceholder';

export function NotFoundPage() {
  return (
    <>
      <PagePlaceholder
        title="Página não encontrada"
        description="O endereço acessado não existe."
      />
      <Anchor component={Link} to="/">
        Voltar ao painel
      </Anchor>
    </>
  );
}
