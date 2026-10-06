import { describe, expect, it } from 'vitest';
import type { DomainErrorCode } from '../errors.js';
import {
  assertEventCanBeRegistered,
  decideEventRegistration,
  type EventFingerprint,
} from './event-rules.js';
import type { TripFacts } from './facts.js';
import type { TripEventType } from './types.js';

const withCode = (code: DomainErrorCode) => expect.objectContaining({ code });

const NOW = new Date('2026-03-20T12:00:00Z');
const CTE_AT = new Date('2026-03-10T12:00:00Z');
const PHOTO_AT = new Date('2026-03-10T15:00:00Z');
const UNLOADED_AT = new Date('2026-03-12T10:00:00Z');

const NOTHING_REGISTERED: TripFacts = {
  cteIssuedAt: null,
  loadingPhotoAt: null,
  unloadedAt: null,
  proofsReceivedAt: null,
  advanceStatus: null,
  balanceStatus: null,
};
const LOADED: TripFacts = {
  ...NOTHING_REGISTERED,
  cteIssuedAt: CTE_AT,
  loadingPhotoAt: PHOTO_AT,
  advanceStatus: 'OPEN',
  balanceStatus: 'OPEN',
};
const UNLOADED: TripFacts = { ...LOADED, unloadedAt: UNLOADED_AT };

const CTE: EventFingerprint = {
  type: 'CTE_ISSUED',
  number: 1234,
  series: 1,
  issuedAt: CTE_AT,
  clientFreightCents: 500000,
};

describe('decideEventRegistration (R6)', () => {
  it('sem evento registrado do mesmo tipo, é NEW', () => {
    expect(decideEventRegistration(null, CTE)).toBe('NEW');
  });

  it('reenvio do CT-e com os mesmos dados é REPLAY', () => {
    const resent: EventFingerprint = { ...CTE, issuedAt: new Date(CTE_AT.getTime()) };
    expect(decideEventRegistration(CTE, resent)).toBe('REPLAY');
  });

  it.each([
    ['número', { number: 1235 }],
    ['série', { series: 2 }],
    ['emissão', { issuedAt: new Date('2026-03-10T12:00:01Z') }],
    ['valor', { clientFreightCents: 500001 }],
  ])('CT-e com %s diferente é EVENT_ALREADY_REGISTERED', (_field, change) => {
    expect(() => decideEventRegistration(CTE, { ...CTE, ...change })).toThrow(
      withCode('EVENT_ALREADY_REGISTERED'),
    );
  });

  it('foto é comparada pelo sha256 do arquivo', () => {
    const photo: EventFingerprint = { type: 'LOADING_PHOTO_ATTACHED', sha256: 'abc' };

    expect(decideEventRegistration(photo, { ...photo })).toBe('REPLAY');
    expect(() => decideEventRegistration(photo, { ...photo, sha256: 'def' })).toThrow(
      withCode('EVENT_ALREADY_REGISTERED'),
    );
  });

  it('descarga e comprovantes são comparados pelo occurredAt', () => {
    const unloading: EventFingerprint = { type: 'UNLOADED', occurredAt: UNLOADED_AT };
    const otherDate: EventFingerprint = { type: 'UNLOADED', occurredAt: NOW };

    expect(decideEventRegistration(unloading, { ...unloading })).toBe('REPLAY');
    expect(() => decideEventRegistration(unloading, otherDate)).toThrow(
      withCode('EVENT_ALREADY_REGISTERED'),
    );
  });
});

describe('assertEventCanBeRegistered (R9)', () => {
  const register = (type: TripEventType, occurredAt: Date, facts: TripFacts) => () =>
    assertEventCanBeRegistered({ type, occurredAt }, { status: 'LOADED', facts }, NOW);

  it('aceita CT-e e foto em qualquer ordem', () => {
    expect(register('LOADING_PHOTO_ATTACHED', PHOTO_AT, NOTHING_REGISTERED)).not.toThrow();
    expect(
      register('CTE_ISSUED', CTE_AT, { ...NOTHING_REGISTERED, loadingPhotoAt: PHOTO_AT }),
    ).not.toThrow();
  });

  it('descarga exige viagem carregada', () => {
    const onlyCte = { ...NOTHING_REGISTERED, cteIssuedAt: CTE_AT };
    expect(register('UNLOADED', UNLOADED_AT, onlyCte)).toThrow(withCode('TRIP_NOT_LOADED'));
  });

  it('comprovantes exigem descarga registrada', () => {
    expect(register('PROOFS_RECEIVED', NOW, LOADED)).toThrow(withCode('UNLOADING_NOT_REGISTERED'));
  });

  it('recusa data no futuro', () => {
    const future = new Date(NOW.getTime() + 1);
    expect(register('UNLOADED', future, LOADED)).toThrow(withCode('INVALID_EVENT_DATE'));
    expect(register('CTE_ISSUED', future, NOTHING_REGISTERED)).toThrow(
      withCode('INVALID_EVENT_DATE'),
    );
  });

  it('recusa descarga anterior ao carregamento, que é o mais tarde entre CT-e e foto', () => {
    const betweenCteAndPhoto = new Date('2026-03-10T14:00:00Z');
    expect(register('UNLOADED', betweenCteAndPhoto, LOADED)).toThrow(
      withCode('INVALID_EVENT_DATE'),
    );
    expect(register('UNLOADED', PHOTO_AT, LOADED)).not.toThrow();
  });

  it('recusa comprovante anterior à descarga', () => {
    const beforeUnloading = new Date(UNLOADED_AT.getTime() - 1);
    expect(register('PROOFS_RECEIVED', beforeUnloading, UNLOADED)).toThrow(
      withCode('INVALID_EVENT_DATE'),
    );
    expect(register('PROOFS_RECEIVED', UNLOADED_AT, UNLOADED)).not.toThrow();
  });

  it('viagem cancelada não aceita eventos', () => {
    expect(() =>
      assertEventCanBeRegistered(
        { type: 'CTE_ISSUED', occurredAt: CTE_AT },
        { status: 'CANCELLED', facts: NOTHING_REGISTERED },
        NOW,
      ),
    ).toThrow(withCode('TRIP_CANCELLED'));
  });
});
