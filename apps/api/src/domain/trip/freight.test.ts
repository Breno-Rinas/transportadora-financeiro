import { describe, expect, it } from 'vitest';
import { getClientFreightCents } from './freight.js';

describe('getClientFreightCents', () => {
  it('com CT-e, vale o valor do CT-e, mesmo havendo frete cotado', () => {
    expect(
      getClientFreightCents({ cteClientFreightCents: 510000, quotedClientFreightCents: 500000 }),
    ).toBe(510000);
  });

  it('sem CT-e, vale o frete cotado', () => {
    expect(
      getClientFreightCents({ cteClientFreightCents: null, quotedClientFreightCents: 500000 }),
    ).toBe(500000);
  });

  it('sem CT-e e sem cotação, é null', () => {
    expect(
      getClientFreightCents({ cteClientFreightCents: null, quotedClientFreightCents: null }),
    ).toBeNull();
  });
});
