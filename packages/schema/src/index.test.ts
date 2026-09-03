import { describe, expect, it } from 'vitest';
import { DATA_VERSION } from './index.js';

describe('datový kontrakt', () => {
  it('drží verzi v1, dokud se nezmění tvar dat v data/', () => {
    expect(DATA_VERSION).toBe('v1');
  });
});
