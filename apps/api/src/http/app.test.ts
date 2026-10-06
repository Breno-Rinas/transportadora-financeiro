import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DomainError } from '../domain/errors.js';
import { buildApp } from './app.js';

let app: FastifyInstance;
let uploadDir: string;

function makeApp(): FastifyInstance {
  uploadDir = mkdtempSync(join(tmpdir(), 'transportadora-uploads-'));
  return buildApp({ uploadDir });
}

afterEach(async () => {
  await app.close();
});

describe('app', () => {
  it('GET /api/health responde ok', async () => {
    app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('rota inexistente responde 404 no formato de erro', async () => {
    app = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/nao-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado' },
    });
  });

  it('ZodError vira 400 VALIDATION_ERROR com os campos em details', async () => {
    app = makeApp();
    app.post('/api/_test/zod', (request) => z.object({ name: z.string() }).parse(request.body));
    const res = await app.inject({ method: 'POST', url: '/api/_test/zod', payload: {} });
    expect(res.statusCode).toBe(400);
    const { error } = res.json<{ error: { code: string; details: { path: string }[] } }>();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details.map((d) => d.path)).toEqual(['name']);
  });

  it('JSON malformado vira 400 VALIDATION_ERROR', async () => {
    app = makeApp();
    app.post('/api/_test/json', () => ({}));
    const res = await app.inject({
      method: 'POST',
      url: '/api/_test/json',
      headers: { 'content-type': 'application/json' },
      payload: '{ invalido',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('VALIDATION_ERROR');
  });

  it('DomainError sem status mapeado vira 500 sem vazar detalhes', async () => {
    app = makeApp();
    app.get('/api/_test/domain', () => {
      throw new DomainError('CODIGO_NAO_MAPEADO', 'detalhe interno');
    });
    const res = await app.inject({ method: 'GET', url: '/api/_test/domain' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' },
    });
  });

  it('serve arquivos de /uploads com nosniff e responde 404 no formato de erro quando falta', async () => {
    app = makeApp();
    writeFileSync(join(uploadDir, 'a.txt'), 'conteudo');

    const found = await app.inject({ method: 'GET', url: '/uploads/a.txt' });
    expect(found.statusCode).toBe(200);
    expect(found.body).toBe('conteudo');
    expect(found.headers['x-content-type-options']).toBe('nosniff');

    const missing = await app.inject({ method: 'GET', url: '/uploads/b.txt' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json<{ error: { code: string } }>().error.code).toBe('NOT_FOUND');
  });
});
