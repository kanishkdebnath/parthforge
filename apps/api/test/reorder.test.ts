import { describe, it, expect } from 'vitest';
import { validateReorderIds } from '../src/lib/reorder.js';

describe('validateReorderIds', () => {
  it('returns null (no error) when the submitted set equals the existing set in any order', () => {
    expect(validateReorderIds(['a', 'b', 'c'], ['b', 'c', 'a'])).toBeNull();
  });

  it('returns an error string when an id is missing from the submitted set', () => {
    const err = validateReorderIds(['a', 'b', 'c'], ['a', 'b']);
    expect(err).toBe('Reorder set does not match current order');
  });

  it('returns an error string when an unknown id appears in the submitted set', () => {
    const err = validateReorderIds(['a', 'b'], ['a', 'b', 'x']);
    expect(err).toBe('Reorder set does not match current order');
  });

  it('returns an error string when the submitted set has duplicates', () => {
    const err = validateReorderIds(['a', 'b', 'c'], ['a', 'b', 'b']);
    expect(err).toBe('Reorder set does not match current order');
  });
});
