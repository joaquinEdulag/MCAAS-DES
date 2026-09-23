import { describe, expect, it } from 'vitest';
import { resolveOriginFieldName } from '../src/config.js';

describe('configuracion de source_name', () => {
  it('omite source_name si INCLUDE_SOURCE_NAME=false', () => {
    expect(resolveOriginFieldName(false, 'source_name', true)).toBeUndefined();
  });

  it('usa source_name si se habilita expresamente', () => {
    expect(resolveOriginFieldName(true, 'source_name', true)).toBe('source_name');
  });

  it('mantiene el fallback multi-origen cuando no se especifica la columna', () => {
    expect(resolveOriginFieldName(true, undefined, true)).toBe('mcaas_origin');
  });
});
