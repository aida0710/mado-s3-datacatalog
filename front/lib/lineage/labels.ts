import { translate } from '../../i18n/translate'
import type { LineageNodeKind } from '../api/types'

export const LINEAGE_KIND_LABEL: Record<LineageNodeKind, string> = {
  get source() { return translate("common.source") },
  get dataset() { return translate("common.dataset") },
  get job() { return translate("common.processing") },
  get version() { return translate("common.version") },
  get run() { return translate("labels.executionHistory") },
  get location() { return translate("common.storageLocations") },
}

const STATUS_LABELS: Record<string, string> = {
  get start() { return translate("labels.running") },
  get starting() { return translate("labels.starting") },
  get running() { return translate("labels.running") },
  get complete() { return translate("labels.completed") },
  get completed() { return translate("labels.completed") },
  get fail() { return translate("labels.failed") },
  get failed() { return translate("labels.failed") },
  get abort() { return translate("labels.aborted") },
  get aborted() { return translate("labels.aborted") },
  get available() { return translate("common.available") },
  get archived() { return translate("common.archived") },
  get missing() { return translate("labels.notFound") },
  get deleted() { return translate("labels.deleted") },
  get unknown() { return translate("common.unknown") },
}

export function lineageStatusLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return STATUS_LABELS[value.toLowerCase()] ?? value
}

/** 状態の色。共通の部品の .status-badge に `status-${tone}` として付ける。 */
export type LineageStatusTone = 'finished' | 'running' | 'failed' | 'canceled' | 'queued'

const STATUS_TONES: Record<string, LineageStatusTone> = {
  start: 'running',
  starting: 'running',
  running: 'running',
  complete: 'finished',
  completed: 'finished',
  available: 'finished',
  fail: 'failed',
  failed: 'failed',
  missing: 'failed',
  abort: 'canceled',
  aborted: 'canceled',
  archived: 'canceled',
  deleted: 'canceled',
}

/** 知らない値は中立の色 (queued) にする。 */
export function lineageStatusTone(value: string | null | undefined): LineageStatusTone | null {
  if (!value) return null
  return STATUS_TONES[value.toLowerCase()] ?? 'queued'
}

export function lineageCompletenessLabel(value: string | null | undefined): string | null {
  if (value === 'complete') return translate("labels.registered")
  if (value === 'partial') return translate("labels.partiallyRegistered")
  if (value === 'unregistered') return translate("common.notRegistered")
  return value ?? null
}

export function lineageSourceKindLabel(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return ({
    purchased: translate("common.purchased"),
    crawled: translate("common.collected"),
    provided: translate("common.provided"),
    generated: translate("common.generated"),
    database: translate("common.database"),
    other: translate("common.other"),
  } as Record<string, string>)[value.toLowerCase()] ?? value
}

export function projectionStateLabel(value: string): string {
  return ({
    synced: translate("labels.applied"),
    lagging: translate("labels.pending"),
    unavailable: translate("labels.synchronizationServiceStopped"),
  } as Record<string, string>)[value.toLowerCase()] ?? value
}
