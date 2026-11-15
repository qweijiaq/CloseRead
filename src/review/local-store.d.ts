/** Type surface for `local-store.js`, which is shipped to the browser as-is. */

export declare const SNAPSHOT_KIND: 'closeread-workspace'
export declare const SNAPSHOT_VERSION: number
export declare const STORES: string[]
export declare const MAX_SNAPSHOT_BYTES: number

export interface Preferences {
  desiredRetention: number
  dailyNewTarget: number
  dailyReviewTarget: number
  weeklyArticleGoal: number
  weeklyStudyDaysGoal: number
}

export declare const DEFAULT_PREFERENCES: Preferences

export interface Settings {
  preferences: Preferences
  [key: string]: unknown
}

export interface SettingsPatch {
  preferences?: Partial<Preferences>
  [key: string]: unknown
}

export interface Snapshot {
  kind: typeof SNAPSHOT_KIND
  version: number
  exportedAt: string
  app: string
  stores: Record<string, Record<string, unknown>>
}

export interface ImportSummary {
  added: number
  replaced: number
  packs: number
  items: number
}

export interface SnapshotDescription {
  exportedAt: string
  packs: number
  resources: number
  items: number
  notes: number
  hasKeys: boolean
}

export type ValidationResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; error: string }

export declare function isStoreName(name: string): boolean
export declare function validateSnapshot(raw: unknown): ValidationResult
export declare function describeSnapshot(snapshot: Partial<Snapshot> | undefined): SnapshotDescription

export declare class MemoryDriver {
  constructor()
  open(): Promise<void>
  get(store: string, key: string): Promise<unknown>
  put(store: string, key: string, value: unknown): Promise<void>
  delete(store: string, key: string): Promise<void>
  entries(store: string): Promise<Array<[string, unknown]>>
  clear(store: string): Promise<void>
}

export declare class IndexedDbDriver {
  constructor(databaseName?: string)
  open(): Promise<IDBDatabase>
  get(store: string, key: string): Promise<unknown>
  put(store: string, key: string, value: unknown): Promise<void>
  delete(store: string, key: string): Promise<void>
  entries(store: string): Promise<Array<[string, unknown]>>
  clear(store: string): Promise<void>
}

export type LocalDriver = MemoryDriver | IndexedDbDriver

export declare class LocalStore {
  constructor(driver?: LocalDriver)
  driver: LocalDriver
  open(): Promise<this>
  getSettings(): Promise<Settings>
  saveSettings(patch: SettingsPatch): Promise<Settings>
  put(store: string, value: Record<string, unknown>): Promise<string>
  putMany(store: string, values: Array<Record<string, unknown>>): Promise<number>
  get(store: string, key: string): Promise<Record<string, unknown> | undefined>
  delete(store: string, key: string): Promise<void>
  list(store: string): Promise<Array<Record<string, unknown>>>
  count(store: string): Promise<number>
  clearAll(): Promise<void>
  exportSnapshot(options?: { includeKeys?: boolean; app?: string }): Promise<Snapshot>
  serialize(options?: { includeKeys?: boolean; app?: string }): Promise<string>
  importSnapshot(raw: unknown, options?: { mode?: 'merge' | 'replace' }): Promise<ImportSummary>
}
