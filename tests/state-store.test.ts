import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SyncStateStore } from '../src/state-store.js';

describe('SyncStateStore', () => {
  it('cambia el stream cuando cambia la tabla destino efectiva', () => {
    const a = SyncStateStore.streamId('Empresa_CONTPAQi', 'erp_nucleo_empresa', ['id']);
    const b = SyncStateStore.streamId('Empresa_CONTPAQi', 'otra_tabla', ['id']);
    expect(a).not.toBe(b);
  });

  it('migra el estado local del nombre legacy al nombre actual sin resincronizar filas iguales', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-state-rename-'));
    const store = new SyncStateStore(dir);
    const legacyStream = SyncStateStore.streamId('Empleado_EDULAG', 'rh_empleado', ['source_name', 'numero_empleado']);
    const currentStream = SyncStateStore.streamId('Empleado_EDULAG', 'erp_rh_empleado', ['source_name', 'numero_empleado']);
    const rows = [{ source_name: 'EDULAG', numero_empleado: '315', nombre_completo: 'Persona' }];
    const first = store.classify(legacyStream, 'dest-1', rows, ['source_name', 'numero_empleado']);
    store.commit(legacyStream, 'dest-1', first);

    expect(store.migrateStream(legacyStream, currentStream)).toBe(true);
    expect(store.classify(currentStream, 'dest-1', rows, ['source_name', 'numero_empleado'])).toHaveLength(0);
    expect(store.migrateStream(legacyStream, currentStream)).toBe(false);
  });

  it('detecta nuevo, sin cambio y actualización por destino', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-state-'));
    const store = new SyncStateStore(dir);
    const stream = SyncStateStore.streamId('x', 'tabla', ['Id']);
    const initial = [{ Id: 1, Nombre: 'A' }];
    const first = store.classify(stream, 'dest-1', initial, ['Id']);
    expect(first).toHaveLength(1); expect(first[0].kind).toBe('NEW');
    store.commit(stream, 'dest-1', first);
    expect(store.classify(stream, 'dest-1', initial, ['Id'])).toHaveLength(0);
    const changed = store.classify(stream, 'dest-1', [{ Id: 1, Nombre: 'B' }], ['Id']);
    expect(changed[0].kind).toBe('UPDATED');
    expect(store.classify(stream, 'dest-2', initial, ['Id'])[0].kind).toBe('NEW');
  });
});
