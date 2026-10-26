import { z } from 'zod'
import { namespaceAllowed } from './namespace-allowlist.js'

export { namespaceAllowed } from './namespace-allowlist.js'

const NonEmpty = z.string().trim().min(1).max(1024)
const Facets = z.record(z.string(), z.unknown()).default({})

const Dataset = z.object({
  namespace: NonEmpty,
  name: NonEmpty,
  facets: Facets,
  inputFacets: z.record(z.string(), z.unknown()).optional(),
  outputFacets: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

export const OpenLineageEventSchema = z.object({
  eventTime: z.string().refine(value => Number.isFinite(Date.parse(value)), 'invalid eventTime'),
  eventType: z.enum(['START', 'RUNNING', 'COMPLETE', 'ABORT', 'FAIL', 'OTHER']),
  run: z.object({
    runId: z.string().uuid(),
    facets: Facets,
  }).passthrough(),
  job: z.object({
    namespace: NonEmpty,
    name: NonEmpty,
    facets: Facets,
  }).passthrough(),
  inputs: z.array(Dataset).default([]),
  outputs: z.array(Dataset).default([]),
  producer: z.string().min(1),
  schemaURL: z.string().min(1),
}).passthrough()

export type OpenLineageEvent = z.infer<typeof OpenLineageEventSchema>
export type OpenLineageDataset = OpenLineageEvent['inputs'][number]

export interface OpenLineageProfileIssue {
  path: string
  message: string
}

export type OpenLineageValidation =
  | { ok: true; event: OpenLineageEvent }
  | { ok: false; issues: OpenLineageProfileIssue[] }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Registry profileが使う、変わらないデータセットの版の識別子を返す。
 *
 * 標準のOpenLineageの連携は、標準の`version` facetを使える。
 * Registryに対応したproducerは、代わりに独自facetの`datasetRegistry`か
 * `madoDataset`にRegistryのUUIDを入れてもよい。
 */
export function datasetVersionIdentity(dataset: OpenLineageDataset): string | null {
  const versionFacet = asRecord(dataset.facets.version)
  const standard = versionFacet?.datasetVersion
  if (typeof standard === 'string' && standard.trim()) return standard

  for (const key of ['datasetRegistry', 'madoDataset']) {
    const facet = asRecord(dataset.facets[key])
    const id = facet?.datasetVersionId
    if (typeof id === 'string' && id.trim()) return id
  }
  return null
}

/** OpenLineageを解析し、正規のRegistry profileを満たすかを検査する。 */
export function validateOpenLineageProfile(value: unknown): OpenLineageValidation {
  const parsed = OpenLineageEventSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }

  const issues: OpenLineageProfileIssue[] = []
  const check = (dataset: OpenLineageDataset, path: string): void => {
    // 購入・クロールした取得元は合成したデータセットとして表すので、内部の
    // DatasetVersionを持たない。
    if (dataset.namespace === 'external-source') return
    if (!datasetVersionIdentity(dataset)) {
      issues.push({
        path,
        message: 'dataset version identity is required (version facet or Registry datasetVersionId)',
      })
    }
  }
  parsed.data.inputs.forEach((dataset, index) => check(dataset, `inputs.${index}`))
  parsed.data.outputs.forEach((dataset, index) => check(dataset, `outputs.${index}`))

  return issues.length > 0 ? { ok: false, issues } : { ok: true, event: parsed.data }
}

export function writableNamespaces(event: OpenLineageEvent): string[] {
  return [...new Set([
    event.job.namespace,
    ...event.outputs
      .filter(dataset => dataset.namespace !== 'external-source')
      .map(dataset => dataset.namespace),
  ])]
}

export function forbiddenWritableNamespaces(
  event: OpenLineageEvent,
  allowed: readonly string[],
): string[] {
  return writableNamespaces(event).filter(namespace => !namespaceAllowed(namespace, allowed))
}
