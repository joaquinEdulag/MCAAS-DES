import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExtractionScript } from '../src/sql-script.js';

describe('parseExtractionScript', () => {
  it('lee tabla y claves desde comentarios MCAAS', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-'));
    const file = path.join(dir, 'q.sql');
    fs.writeFileSync(file, '-- MCAAS_NAME=Clientes\n-- MCAAS_TARGET_TABLE=public.clientes\n-- MCAAS_KEY_COLUMNS=Id, EmpresaId\nSELECT * FROM x;');
    const meta = parseExtractionScript(file);
    expect(meta.name).toBe('Clientes');
    expect(meta.targetTable).toBe('public.clientes');
    expect(meta.keyColumns).toEqual(['Id', 'EmpresaId']);
  });
});
