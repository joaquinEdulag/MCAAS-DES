import path from 'node:path';
import type { DestinationState, RowChange, RowData, SyncStateFile } from './types.js';
import { atomicWriteJson, ensureDir, readJsonIfExists, sha256, shortHash } from './utils.js';

export class SyncStateStore {
  private readonly filePath: string;
  private state: SyncStateFile;

  constructor(stateDir: string) {
    ensureDir(stateDir);
    this.filePath = path.join(stateDir, 'sync-state.json');
    this.state = readJsonIfExists<SyncStateFile>(this.filePath, { version: 1, streams: {} });
    if (!this.state.streams) this.state = { version: 1, streams: {} };
  }

  static streamId(scriptName: string, targetTable: string, keyColumns: string[]): string {
    return shortHash({ scriptName, targetTable, keyColumns }, 32);
  }

  private destination(streamId: string, destinationId: string): DestinationState {
    this.state.streams[streamId] ||= { destinations: {} };
    this.state.streams[streamId].destinations[destinationId] ||= { rows: {} };
    return this.state.streams[streamId].destinations[destinationId];
  }

  classify(streamId: string, destinationId: string, rows: RowData[], keyColumns: string[]): RowChange[] {
    const destination = this.destination(streamId, destinationId);
    const changes: RowChange[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const keyObject = Object.fromEntries(keyColumns.map((key) => [key, row[key]]));
      const keyHash = sha256(keyObject);
      if (seen.has(keyHash)) throw new Error(`La extracción contiene claves duplicadas para ${keyColumns.join(', ')}. La clave de sincronización debe ser única.`);
      seen.add(keyHash);
      const dataHash = sha256(row);
      const previous = destination.rows[keyHash];
      if (previous === dataHash) continue;
      changes.push({ row, keyHash, dataHash, kind: previous ? 'UPDATED' : 'NEW' });
    }
    return changes;
  }

  commit(streamId: string, destinationId: string, changes: RowChange[]): void {
    const destination = this.destination(streamId, destinationId);
    for (const change of changes) destination.rows[change.keyHash] = change.dataHash;
    atomicWriteJson(this.filePath, this.state);
  }

  summary(): Record<string, unknown> {
    const streams = Object.entries(this.state.streams).map(([streamId, stream]) => ({
      streamId,
      destinations: Object.fromEntries(Object.entries(stream.destinations).map(([id, state]) => [id, Object.keys(state.rows).length])),
    }));
    return { file: this.filePath, streams };
  }
}
