import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseExtractionScript } from '../src/sql-script.js';
import { SyncStateStore } from '../src/state-store.js';
import { FailureTracker } from '../src/failure-tracker.js';
import { assertAutoIdNotProvided } from '../src/db/base.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-smoke-'));
const sqlFile = path.join(dir, 'q.sql');
fs.writeFileSync(sqlFile, '-- MCAAS_TARGET_TABLE=t\n-- MCAAS_KEY_COLUMNS=source_id\nSELECT 1 AS source_id;');
assert.equal(parseExtractionScript(sqlFile).targetTable, 't');

const store = new SyncStateStore(path.join(dir, 'state'));
const stream = SyncStateStore.streamId('q', 't', ['source_id', 'source_name']);
const first = store.classify(stream, 'dest-1', [{ source_id: 1, Value: 'A', source_name: 'Matriz' }], ['source_id', 'source_name']);
assert.equal(first.length, 1);
assert.equal(first[0].kind, 'NEW');
store.commit(stream, 'dest-1', first);
assert.equal(store.classify(stream, 'dest-1', [{ source_id: 1, Value: 'A', source_name: 'Matriz' }], ['source_id', 'source_name']).length, 0);
assert.equal(store.classify(stream, 'dest-1', [{ source_id: 1, Value: 'B', source_name: 'Matriz' }], ['source_id', 'source_name'])[0].kind, 'UPDATED');

// El mismo ID de origen no colisiona si el origen lógico es distinto.
const sameIdDifferentOrigins = store.classify(
  SyncStateStore.streamId('multi', 't', ['source_id', 'source_name']),
  'dest-1',
  [
    { source_id: 7, Value: 'A', source_name: 'Matriz' },
    { source_id: 7, Value: 'B', source_name: 'Sucursal' },
  ],
  ['source_id', 'source_name'],
);
assert.equal(sameIdDifferentOrigins.length, 2);

assertAutoIdNotProvided(['source_id', 'Value'], 'id');
assert.throws(() => assertAutoIdNotProvided(['id', 'Value'], 'id'));

const failures = new FailureTracker(path.join(dir, 'failure'), 2, 1);
assert.equal(failures.recordFailure('a', new Date('2026-01-01T00:00:00Z')).becamePersistent, false);
assert.equal(failures.recordFailure('b', new Date('2026-01-01T00:01:00Z')).becamePersistent, true);
failures.clear();
assert.equal(failures.reload().active, false);
console.log('MCAAS-DES v1.1 smoke tests: OK');
