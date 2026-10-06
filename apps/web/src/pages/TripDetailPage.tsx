import { useParams } from 'react-router';
import { PagePlaceholder } from './PagePlaceholder';

export function TripDetailPage() {
  const { id } = useParams();
  return <PagePlaceholder title="Detalhe da viagem" description={`Viagem ${id ?? ''}`} />;
}
