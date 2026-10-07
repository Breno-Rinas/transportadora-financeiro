import { describe, expect, it } from 'vitest';
import { buildTripFacts, getLoadedAt } from './facts.js';

const cteAt = new Date('2026-03-10T12:00:00Z');
const photoAt = new Date('2026-03-10T15:00:00Z');

describe('buildTripFacts', () => {
  it('lê os instantes dos eventos e o status dos títulos do motorista', () => {
    const facts = buildTripFacts(
      [
        { type: 'LOADING_PHOTO_ATTACHED', occurredAt: photoAt },
        { type: 'CTE_ISSUED', occurredAt: cteAt },
      ],
      [
        { kind: 'CLIENT_FREIGHT', status: 'OPEN' },
        { kind: 'ADVANCE', status: 'PAID' },
        { kind: 'BALANCE', status: 'OPEN' },
      ],
    );

    expect(facts).toEqual({
      cteIssuedAt: cteAt,
      loadingPhotoAt: photoAt,
      unloadedAt: null,
      proofsReceivedAt: null,
      advanceStatus: 'PAID',
      balanceStatus: 'OPEN',
      cancelledAt: null,
      advanceRecoveryStatus: null,
    });
  });

  it('lê o cancelamento e a recuperação do adiantamento (R13)', () => {
    const cancelledAt = new Date('2026-03-11T10:00:00Z');
    const facts = buildTripFacts(
      [
        { type: 'CTE_ISSUED', occurredAt: cteAt },
        { type: 'LOADING_PHOTO_ATTACHED', occurredAt: photoAt },
        { type: 'TRIP_CANCELLED', occurredAt: cancelledAt },
      ],
      [
        { kind: 'ADVANCE', status: 'PAID' },
        { kind: 'BALANCE', status: 'CANCELLED' },
        { kind: 'ADVANCE_RECOVERY', status: 'OPEN' },
      ],
    );

    expect(facts).toMatchObject({
      cancelledAt,
      advanceStatus: 'PAID',
      balanceStatus: 'CANCELLED',
      advanceRecoveryStatus: 'OPEN',
    });
  });
});

describe('getLoadedAt', () => {
  it('é o mais tarde entre CT-e e foto, em qualquer ordem', () => {
    const facts = buildTripFacts(
      [
        { type: 'CTE_ISSUED', occurredAt: cteAt },
        { type: 'LOADING_PHOTO_ATTACHED', occurredAt: photoAt },
      ],
      [],
    );
    const inverted = buildTripFacts(
      [
        { type: 'CTE_ISSUED', occurredAt: photoAt },
        { type: 'LOADING_PHOTO_ATTACHED', occurredAt: cteAt },
      ],
      [],
    );

    expect(getLoadedAt(facts)).toBe(photoAt);
    expect(getLoadedAt(inverted)).toBe(photoAt);
  });

  it('é null enquanto falta o CT-e ou a foto', () => {
    expect(getLoadedAt(buildTripFacts([{ type: 'CTE_ISSUED', occurredAt: cteAt }], []))).toBeNull();
    expect(
      getLoadedAt(buildTripFacts([{ type: 'LOADING_PHOTO_ATTACHED', occurredAt: photoAt }], [])),
    ).toBeNull();
  });
});
