import path from 'node:path';
import type { PersistentErrorState } from './types.js';
import { atomicWriteJson, ensureDir, isoNow, readJsonIfExists } from './utils.js';

export class FailureTracker {
  private readonly filePath: string;
  private state: PersistentErrorState;

  constructor(stateDir: string, private readonly threshold: number, private readonly windowHours: number) {
    ensureDir(stateDir);
    this.filePath = path.join(stateDir, 'persistent-error.json');
    this.state = this.read();
  }

  private read(): PersistentErrorState {
    return readJsonIfExists<PersistentErrorState>(this.filePath, { active: false, failureTimestamps: [] });
  }

  reload(): PersistentErrorState { this.state = this.read(); return this.state; }
  snapshot(): PersistentErrorState { return structuredClone(this.state); }
  isPersistent(): boolean { return this.state.active; }

  recordFailure(reason: string, now = new Date()): { becamePersistent: boolean; state: PersistentErrorState } {
    this.reload();
    const cutoff = now.getTime() - this.windowHours * 60 * 60 * 1000;
    const timestamps = this.state.failureTimestamps
      .map((value) => new Date(value))
      .filter((value) => Number.isFinite(value.getTime()) && value.getTime() >= cutoff)
      .map((value) => value.toISOString());
    timestamps.push(now.toISOString());
    const becamePersistent = !this.state.active && timestamps.length >= this.threshold;
    this.state = {
      ...this.state,
      active: this.state.active || becamePersistent,
      firstTriggeredAt: becamePersistent ? now.toISOString() : this.state.firstTriggeredAt,
      lastFailureAt: now.toISOString(),
      lastReason: reason,
      failureTimestamps: timestamps,
      ...(becamePersistent ? { alertSentAt: undefined } : {}),
    };
    atomicWriteJson(this.filePath, this.state);
    return { becamePersistent, state: this.snapshot() };
  }

  prune(now = new Date()): void {
    this.reload();
    const cutoff = now.getTime() - this.windowHours * 60 * 60 * 1000;
    this.state.failureTimestamps = this.state.failureTimestamps.filter((value) => new Date(value).getTime() >= cutoff);
    atomicWriteJson(this.filePath, this.state);
  }

  markAlertSent(): void { this.reload(); this.state.alertSentAt = isoNow(); atomicWriteJson(this.filePath, this.state); }

  clear(): void {
    this.state = { active: false, failureTimestamps: [] };
    atomicWriteJson(this.filePath, this.state);
  }
}
