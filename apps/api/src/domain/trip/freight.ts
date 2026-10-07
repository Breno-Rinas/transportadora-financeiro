/**
 * Frete do cliente exibido para a viagem: o valor do CT-e, que é o faturado; sem CT-e, o frete
 * cotado; null se nenhum dos dois existe.
 */
export function getClientFreightCents(trip: {
  cteClientFreightCents: number | null;
  quotedClientFreightCents: number | null;
}): number | null {
  return trip.cteClientFreightCents ?? trip.quotedClientFreightCents;
}
