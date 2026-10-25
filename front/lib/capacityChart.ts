import type { CapacityPoint } from './api/types'

export type CapacityChartPoint = {
  collectedAt: number
  totalBytes: number | null
  objectCount: number | null
}

/** 長い欠測区間へnull点を入れ、グラフが未計測期間を補間しないようにする。 */
export function capacityChartData(points: CapacityPoint[], intervalSeconds: number): CapacityChartPoint[] {
  const rows: CapacityChartPoint[] = []
  let previous: CapacityPoint | undefined
  for (const point of points) {
    if (previous && Date.parse(point.collectedAt) - Date.parse(previous.collectedAt) > intervalSeconds * 2.5 * 1000) {
      rows.push({
        collectedAt: (Date.parse(point.collectedAt) + Date.parse(previous.collectedAt)) / 2,
        totalBytes: null, objectCount: null,
      })
    }
    rows.push({
      collectedAt: Date.parse(point.collectedAt), totalBytes: point.totalBytes,
      objectCount: point.objectCount,
    })
    previous = point
  }
  return rows
}
