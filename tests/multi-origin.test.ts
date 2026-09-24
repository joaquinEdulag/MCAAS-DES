import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertAutoIdNotProvided } from '../src/db/base.js';
import { SyncStateStore } from '../src/state-store.js';

describe('identidad por origen', () => {
  it('permite el mismo ID funcional si cambia el origen', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-origin-'));
    const store = new SyncStateStore(dir);
    const stream = SyncStateStore.streamId('Empleados', 'empleados', ['empleado_id', 'source_name']);
    const rows = [
      { empleado_id: 10, nombre: 'Ana', source_name: 'Empleados_Matriz' },
      { empleado_id: 10, nombre: 'Luis', source_name: 'Empleados_Sucursal_Norte' },
    ];
    const changes = store.classify(stream, 'dest-1', rows, ['empleado_id', 'source_name']);
    expect(changes).toHaveLength(2);
    expect(changes.every((change) => change.kind === 'NEW')).toBe(true);
  });

  it('protege la PK autoincremental del destino', () => {
    expect(() => assertAutoIdNotProvided(['id', 'nombre'], 'id')).toThrow(/DESTINATION_AUTO_ID_COLUMN/i);
    expect(() => assertAutoIdNotProvided(['empleado_id', 'nombre'], 'id')).not.toThrow();
  });
});
