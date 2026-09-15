import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseExtractionScript } from '../src/sql-script.js';
import { SyncStateStore } from '../src/state-store.js';
import { FailureTracker } from '../src/failure-tracker.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-smoke-'));
const sqlFile = path.join(dir, 'q.sql');
fs.writeFileSync(sqlFile, '-- MCAAS_TARGET_TABLE=t\n-- MCAAS_KEY_COLUMNS=Id\nSELECT 1 AS Id;');
assert.equal(parseExtractionScript(sqlFile).targetTable, 't');

const store = new SyncStateStore(path.join(dir, 'state'));
const stream = SyncStateStore.streamId('q', 't', ['Id']);
const first = store.classify(stream, 'dest-1', [{ Id: 1, Value: 'A' }], ['Id']);
assert.equal(first.length, 1);
assert.equal(first[0].kind, 'NEW');
store.commit(stream, 'dest-1', first);
assert.equal(store.classify(stream, 'dest-1', [{ Id: 1, Value: 'A' }], ['Id']).length, 0);
assert.equal(store.classify(stream, 'dest-1', [{ Id: 1, Value: 'B' }], ['Id'])[0].kind, 'UPDATED');

const failures = new FailureTracker(path.join(dir, 'failure'), 2, 1);
assert.equal(failures.recordFailure('a', new Date('2026-01-01T00:00:00Z')).becamePersistent, false);
assert.equal(failures.recordFailure('b', new Date('2026-01-01T00:01:00Z')).becamePersistent, true);
failures.clear();
assert.equal(failures.reload().active, false);
console.log('MCAAS-DES smoke tests: OK');
