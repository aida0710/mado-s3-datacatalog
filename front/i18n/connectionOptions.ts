import { translate } from './translate'
import type { Capability, Provider, StorageClassKey } from '../lib/api/types'

export const CAPABILITY_UI: ReadonlyArray<{
  key: Capability
  label: string
  help: string
}> = [
  { key: 'list',             get label() { return translate("connectionOptions.listBucketsAndObjects") },
    get help() { return translate("connectionOptions.coreConnectionFunctionalityDisablingThisHidesAllData") } },
  { key: 'preview',          get label() { return translate("connectionOptions.filePreviewsTextImageAudioVideo") },
    get help() { return translate("connectionOptions.readsFileContentDisableThisForBucketsWhere") } },
  { key: 'download',         get label() { return translate("connectionOptions.fileDownloads") },
    get help() { return translate("connectionOptions.downloadButtonsInRowMenusAndPreviewsDisabling") } },
  { key: 'archive',          get label() { return translate("connectionOptions.openArchivesTarTarGzTarXz") },
    get help() { return translate("connectionOptions.listsArchiveContentsAndPreviewsIndividualEntriesTar") } },
  { key: 'audioInfo',        get label() { return translate("connectionOptions.audioInformationAndWaveforms") },
    get help() { return translate("connectionOptions.downloadsAndAnalyzesTheEntireFileConnectionsWith") } },
  { key: 'audioSpectrogram', get label() { return translate("connectionOptions.spectrograms") },
    get help() { return translate("connectionOptions.spectrogramsAreAlsoUnavailableWhenAudioInformationAnd") } },
  { key: 'readmeRead',       get label() { return translate("connectionOptions.readReadmes") },
    get help() { return translate("connectionOptions.readsEachDirectorySReadmeMdFromS3") } },
  { key: 'readmeWrite',      get label() { return translate("connectionOptions.editReadmes") },
    get help() { return translate("connectionOptions.writesReadmeMdBackToTheBucketRequires") } },
]

export const PROVIDER_LABELS: Record<Provider, string> = {
  aws:    'AWS S3',
  wasabi: 'Wasabi',
  get onprem() { return translate("connectionOptions.internalOtherNoCost") },
  get other() { return translate("common.other") },
}

export const STORAGE_CLASS_OPTIONS: Array<{ key: StorageClassKey; label: string; help: string }> = [
  { key: 'STANDARD',            label: 'Standard',
    get help() { return translate("connectionOptions.defaultNoRetrievalChargesOrMinimumRetentionPeriod") } },
  { key: 'INTELLIGENT_TIERING', label: 'Intelligent-Tiering',
    get help() { return translate("connectionOptions.automaticallyMovesDataBetweenTiersBasedOnAccess") } },
  { key: 'STANDARD_IA',         label: 'Standard-IA',
    get help() { return translate("connectionOptions.aboutHalfTheMonthlyCostReadsIncurPer") } },
  { key: 'ONEZONE_IA',          label: 'One Zone-IA',
    get help() { return translate("connectionOptions.storedInASingleAvailabilityZoneSuitableFor") } },
  { key: 'GLACIER_IR',          label: 'Glacier Instant Retrieval',
    get help() { return translate("connectionOptions.immediateRetrievalWithHigherPerGbChargesMinimum") } },
  { key: 'GLACIER',             label: 'Glacier Flexible Retrieval',
    get help() { return translate("connectionOptions.retrievalTakesMinutesToHoursMinimumRetention90") } },
  { key: 'DEEP_ARCHIVE',        label: 'Glacier Deep Archive',
    get help() { return translate("connectionOptions.lowestCostRetrievalTakesRoughlyHalfADay") } },
]
