import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('prefixa /api, monta a querystring sem valores vazios e devolve o JSON', async () => {
    const fetchMock = mockFetch(Response.json({ ok: true }));
    const result = await api.get('/trips', { status: 'LOADED', q: '', clientId: undefined });
    expect(result).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/trips?status=LOADED');
  });

  it('lança ApiError com code e message do formato de erro do backend', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'BALANCE_LOCKED', message: 'Saldo travado', details: { a: 1 } } },
        { status: 422 },
      ),
    );
    const error = await api.post('/titles/schedule', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'BALANCE_LOCKED',
      message: 'Saldo travado',
      details: { a: 1 },
    });
  });

  it('trata resposta de erro sem o formato do backend sem vazar o corpo', async () => {
    mockFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));
    const error = await api.get('/dashboard').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' });
  });

  it('converte falha de rede em ApiError NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await api.get('/dashboard').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
