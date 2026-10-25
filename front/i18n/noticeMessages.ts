import type { EstimateWarning, LineageProjectionStatus, LineageWarning, ManualFactNote } from '../lib/api/types'
import { fmtCount, fmtSize, fmtUnitPriceUsd } from '../lib/format'
import { translate } from './translate'

// API が返すお知らせ (見積もりの注意・DataLineage の警告・単価の注記) を、code から今の言語の文にする。
// API は書式を付けない値を横の項目で渡すので、数や容量の書き方はここで画面の言語に合わせる。

export function transferWarningMessage(warning: EstimateWarning): string {
  switch (warning.code) {
    case 'ratesUnavailable':
      return translate('transferWarnings.ratesUnavailable', { value0: warning.region ?? translate('connectionForm.unknown') })
    case 'minDuration':
      return translate('transferWarnings.minDuration', { value0: warning.days })
    case 'retrievalCost':
      return translate('transferWarnings.retrievalCost', { value0: fmtUnitPriceUsd(warning.usdPerGb) })
    case 'archiveRetrievalTime':
      return translate('transferWarnings.archiveRetrievalTime')
    case 'sourceArchiveRestore':
      return translate('transferWarnings.sourceArchiveRestore')
    case 'wasabiPolicy':
      return translate('transferWarnings.wasabiPolicy')
    case 'proxyRate':
      return translate('transferWarnings.proxyRate')
    case 'manualRate':
      return translate('transferWarnings.manualRate')
    case 'smallObjects':
      return translate('transferWarnings.smallObjects', {
        value0: fmtSize(warning.averageObjectBytes), value1: fmtSize(warning.minimumBillableBytes),
      })
    case 'objectOverhead':
      return translate('transferWarnings.objectOverhead', {
        value0: fmtSize(warning.overheadBytesPerObject), value1: fmtCount(warning.objectCount),
        value2: fmtSize(warning.overheadBytes), value3: warning.percentOfBillable,
      })
    case 'capacity':
      return translate('transferWarnings.capacity', { value0: fmtSize(warning.capacityBytes), value1: fmtSize(warning.requiredBytes) })
  }
}

export function lineageWarningMessage(warning: LineageWarning): string {
  switch (warning.code) {
    case 'marquezProjectionUnavailable':
      return translate('lineageWarnings.marquezProjectionUnavailable')
    case 'registryEnrichmentUnavailable':
      return translate('lineageWarnings.registryEnrichmentUnavailable')
    case 'malformedMarquezNode':
      return translate('lineageWarnings.malformedMarquezNode', { value0: warning.nodeId })
    case 'registrySearchUnavailable':
      return translate('lineageWarnings.registrySearchUnavailable')
    case 'marquezSearchUnavailable':
      return translate('lineageWarnings.marquezSearchUnavailable')
  }
}

/** グラフの反映状態を取れなかった理由。 */
export function projectionUnavailableMessage(code: NonNullable<LineageProjectionStatus['code']>): string {
  return code === 'registryProjectionUnavailable'
    ? translate('lineageWarnings.registryProjectionUnavailable')
    : translate('lineageWarnings.marquezProjectionUnavailable')
}

export function pricingNoteMessage(note: ManualFactNote): string {
  switch (note) {
    case 'awsMinimumRetention':
      return translate('pricingNotes.awsMinimumRetention')
    case 'awsMinimumBillableSize':
      return translate('pricingNotes.awsMinimumBillableSize')
    case 'deepArchiveStorageRate':
      return translate('pricingNotes.deepArchiveStorageRate')
    case 'wasabiManualRates':
      return translate('pricingNotes.wasabiManualRates')
  }
}
