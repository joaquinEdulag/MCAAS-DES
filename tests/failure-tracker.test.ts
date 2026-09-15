import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FailureTracker } from '../src/failure-tracker.js';

describe('FailureTracker', () => {
  it('activa error persistente al alcanzar N fallos en ventana', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcaas-failure-'));
    const tracker = new FailureTracker(dir, 3, 1);
    expect(tracker.recordFailure('1', new Date('2026-01-01T00:00:00Z')).becamePersistent).toBe(false);
    expect(tracker.recordFailure('2', new Date('2026-01-01T00:10:00Z')).becamePersistent).toBe(false);
    expect(tracker.recordFailure('3', new Date('2026-01-01T00:20:00Z')).becamePersistent).toBe(true);
    expect(tracker.isPersistent()).toBe(true);
    tracker.clear();
    expect(tracker.reload().active).toBe(false);
  });
});
