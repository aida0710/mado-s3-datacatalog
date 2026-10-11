import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { useEffect, useId, useReducer, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { CAPABILITY_UI, PROVIDER_LABELS, STORAGE_CLASS_OPTIONS } from '../i18n/connectionOptions'
import { api } from '../lib/api/client'
import type {
  Connection,
  ConnectionAccessUser,
  ConnectionCreateInput,
  ConnectionUpdateInput,
  Provider,
  StorageClassKey,
} from '../lib/api/types'
import {
  initialState, reducer, toCreateInput, toUpdateInput, validateForm, type FormState,
} from '../lib/connectionFormState'
import { Dialog } from './Dialog'

const getCapacityIntervals = () => [
  [21600, translate("connectionForm.6Hours")], [43200, translate("connectionForm.12Hours")], [86400, translate("connectionForm.24Hours")],
  [259200, translate("connectionForm.3Days")], [604800, translate("connectionForm.7Days")],
] as const

type Mode =
  | { kind: 'create'; onSubmit: (input: ConnectionCreateInput) => Promise<void> }
  | { kind: 'edit'; current: Connection; onSubmit: (input: ConnectionUpdateInput) => Promise<void> }

interface Props {
  mode: Mode
  onClose: () => void
  /** page = 設定の中に一つの画面として出す。modal = ダイアログに重ねて出す。 */
  presentation?: 'modal' | 'page'
}

/** 説明つきの選択肢の一行。チェックボックス・ラジオは左、文言は右。 */
function Choice({ control, title, help }: { control: ReactNode; title: ReactNode; help?: ReactNode }) {
  useLocale()
  return (
    <label className="choice">
      {control}
      <span>
        <strong>{title}</strong>
        {help && <small>{help}</small>}
      </span>
    </label>
  )
}

/** 値を選ぶ・入れる設定の一行。文言は左、選択肢や数値の欄は右 (狭い画面では下)。 */
function ValueChoice({ control, title, help }: { control: ReactNode; title: ReactNode; help?: ReactNode }) {
  useLocale()
  return (
    <label className="choice choice--value">
      <span>
        <strong>{title}</strong>
        {help && <small>{help}</small>}
      </span>
      {control}
    </label>
  )
}

export function ConnectionForm({ mode, onClose, presentation = 'modal' }: Props) {
  useLocale()
  const isEdit = mode.kind === 'edit'
  const current = mode.kind === 'edit' ? mode.current : null
  const ids = useId()

  const [state, dispatch] = useReducer(reducer, current, initialState)
  const [accessUsers, setAccessUsers] = useState<ConnectionAccessUser[]>([])
  const [accessUsersError, setAccessUsersError] = useState<string | null>(null)
  const {
    name, endpoint, region, accessKeyId, secretAccessKey,
    forcePathStyle, listObjectsVersion, capabilities, showSecret, saving, error,
    visibilityMode, allowedUserIds,
    scanEnabled,
    scanPageSize,
    capacityMetricsEnabled,
    listCacheTtlSec,
    capacityTrackingEnabled, capacityTrackingIntervalSeconds,
    pricingProvider, pricingStorageClass, pricingReadMbps, pricingWriteMbps,
    pricingCapacityTb, pricingInstability, pricingStoragePerGbMonth,
  } = state

  useEffect(() => {
    let active = true
    api.listConnectionAccessUsers()
      .then(body => { if (active) setAccessUsers(body.users) })
      .catch(cause => {
        if (active) setAccessUsersError(cause instanceof Error ? cause.message : translate("common.couldNotLoadUsers"))
      })
    return () => { active = false }
  }, [])

  const titleId = 'connection-form-title'
  const title = isEdit ? translate("connectionForm.editConnection") : translate("common.addConnection")

  const submit = async () => {
    const clientError = validateForm(state, isEdit)
    if (clientError) {
      dispatch({ type: 'setError', error: clientError })
      return
    }

    dispatch({ type: 'startSave' })
    try {
      if (mode.kind === 'create') await mode.onSubmit(toCreateInput(state))
      else await mode.onSubmit(toUpdateInput(state, mode.current))
      dispatch({ type: 'saveDone' })
    } catch (e) {
      dispatch({ type: 'saveFailed', error: (e as Error).message })
    }
  }

  const accessKeyPlaceholder = isEdit && current
    ? translate("connectionForm.leaveBlankToKeepUnchanged", { value0: current.accessKeyIdMasked })
    : ''
  const secretPlaceholder = isEdit ? translate("connectionForm.leaveBlankToKeepUnchanged2") : ''

  const fields = (
    <>
      <h3 className="form-section-heading">{translate("connectionForm.basicInformation")}</h3>
      <label className="field">
        <span>{translate("common.name")}</span>
        <input
          value={name}
          onChange={e => dispatch({ type: 'setField', field: 'name', value: e.target.value })}
          placeholder={translate("connectionForm.eGProduction")}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span>{translate("connectionForm.endpoint")}</span>
        <input
          type="url"
          value={endpoint}
          onChange={e => dispatch({ type: 'setField', field: 'endpoint', value: e.target.value })}
          placeholder="https://s3.example.com"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span>{translate("connectionForm.region")}</span>
        <input
          value={region}
          onChange={e => dispatch({ type: 'setField', field: 'region', value: e.target.value })}
          placeholder={translate("common.auto")}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      <h3 className="form-section-heading">{translate("connectionForm.credentials")}</h3>
      <label className="field">
        <span>{translate("connectionForm.accessKeyId")}</span>
        <input
          value={accessKeyId}
          onChange={e => dispatch({ type: 'setField', field: 'accessKeyId', value: e.target.value })}
          placeholder={accessKeyPlaceholder}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <div className="field">
        <label htmlFor={`${ids}-secret`}>{translate("connectionForm.secretAccessKey")}</label>
        <div className="input-with-button">
          <input
            id={`${ids}-secret`}
            type={showSecret ? 'text' : 'password'}
            value={secretAccessKey}
            onChange={e => dispatch({ type: 'setField', field: 'secretAccessKey', value: e.target.value })}
            placeholder={secretPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="button"
            onClick={() => dispatch({ type: 'setField', field: 'showSecret', value: !showSecret })}
            aria-label={showSecret ? translate("connectionForm.hideSecret") : translate("connectionForm.showSecret")}
          >
            {showSecret ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            {showSecret ? translate("connectionForm.hide") : translate("common.show")}
          </button>
        </div>
      </div>

      <fieldset className="choice-group">
        <legend>{translate("connectionForm.userAccess")}</legend>
        <p className="muted">
          {translate("connectionForm.connectionsAreNormallyAvailableToEveryoneWithAn")}</p>
        <div className="choice-list">
          <Choice
            control={
              <input
                type="radio"
                name="visibilityMode"
                aria-label={translate("connectionForm.everyone")}
                checked={visibilityMode === 'public'}
                onChange={() => dispatch({ type: 'setField', field: 'visibilityMode', value: 'public' })}
              />
            }
            title={translate("connectionForm.everyone")}
            help={translate("connectionForm.defaultAllUsersWhoCanSignInCan")}
          />
          <Choice
            control={
              <input
                type="radio"
                name="visibilityMode"
                aria-label={translate("connectionForm.allowlist")}
                checked={visibilityMode === 'whitelist'}
                onChange={() => dispatch({ type: 'setField', field: 'visibilityMode', value: 'whitelist' })}
              />
            }
            title={translate("connectionForm.allowlist")}
            help={translate("connectionForm.onlyUsersSelectedBelowCanSeeThisConnection")}
          />
        </div>
        {visibilityMode === 'whitelist' && (
          <div className="choice-users" role="group" aria-label={translate("connectionForm.usersAllowedToConnect")}>
            {accessUsersError && <p className="notice error" role="alert">{localizeMessage(accessUsersError)}</p>}
            {!accessUsersError && accessUsers.length === 0 && (
              <p className="muted">{translate("connectionForm.thereAreNoUsersToSelectOnlyConnection")}</p>
            )}
            {accessUsers.length > 0 && (
              <div className="choice-list">
                {accessUsers.map(user => (
                  <Choice
                    key={user.id}
                    control={
                      <input
                        type="checkbox"
                        aria-label={translate("connectionForm.allow", { value0: user.displayName })}
                        checked={allowedUserIds.includes(user.id)}
                        onChange={event => dispatch({
                          type: 'toggleAllowedUser', userId: user.id, value: event.target.checked,
                        })}
                      />
                    }
                    title={<>{user.displayName}{user.status === 'disabled' ? translate("connectionForm.disabled") : ''}</>}
                    help={user.username ?? user.email ?? user.id}
                  />
                ))}
              </div>
            )}
            {allowedUserIds.length === 0 && (
              <p className="muted">{translate("connectionForm.ifNoUsersAreSelectedOnlyConnectionAdministrators")}</p>
            )}
          </div>
        )}
      </fieldset>

      <h3 className="form-section-heading">{translate("connectionForm.compatibility")}</h3>
      {/* Path-style URL: 単一の選択肢として ListObjects と同じ構造で扱う。 */}
      <fieldset className="choice-group">
        <legend>Path-style URL</legend>
        <div className="choice-list">
          <Choice
            control={
              <input
                type="checkbox"
                aria-label={translate("connectionForm.usePathStyleUrls")}
                checked={forcePathStyle}
                onChange={e => dispatch({ type: 'setField', field: 'forcePathStyle', value: e.target.checked })}
              />
            }
            title={translate("connectionForm.usePathStyleUrls")}
            help={
              <>
                {translate("connectionForm.minIoAndSelfHostedS3CompatibleServers")}</>
            }
          />
        </div>
      </fieldset>

      {/* ListObjects API バージョン: V2 を理解しないサーバ
          (V1 only の S3 互換実装) は v1 を選ぶ。 */}
      <fieldset className="choice-group">
        <legend>{translate("common.listObjectsApiVersion")}</legend>
        <div className="choice-list">
          <Choice
            control={
              <input
                type="radio"
                name="listObjectsVersion"
                value="v2"
                aria-label="ListObjects v2"
                checked={listObjectsVersion === 'v2'}
                onChange={() => dispatch({ type: 'setField', field: 'listObjectsVersion', value: 'v2' })}
              />
            }
            title="v2"
            help={translate("connectionForm.forModernImplementationsSuchAsAwsS3Cloudflare")}
          />
          <Choice
            control={
              <input
                type="radio"
                name="listObjectsVersion"
                value="v1"
                aria-label="ListObjects v1"
                checked={listObjectsVersion === 'v1'}
                onChange={() => dispatch({ type: 'setField', field: 'listObjectsVersion', value: 'v1' })}
              />
            }
            title="v1"
            help={
              <>
                {translate("connectionForm.forOlderS3CompatibleServersWithoutListObjects")}</>
            }
          />
        </div>
      </fieldset>

      {/* 接続ごとの権限。認証のあるツールではないのでアクセス制御ではなく
          誤操作の防止 — Deep Archive のように「一覧は見たいが本体には触りたく
          ない」接続で危険な導線を閉じるためのもの。UI で隠すだけでなく API 側も
          403 で止める。 */}
      <h3 id={`${ids}-capabilities`} className="form-section-heading">{translate("connectionForm.allowedOperations")}</h3>
      <fieldset className="choice-group" aria-labelledby={`${ids}-capabilities`}>
        <p className="muted">
          {translate("connectionForm.disablingAnOperationHidesItFromTheUi")}</p>
        <div className="choice-list">
          {CAPABILITY_UI.map(({ key, label, help }) => (
            <Choice
              key={key}
              control={
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={capabilities[key]}
                  // README 編集は読み込みが前提 (API も 400 で弾く)。
                  disabled={key === 'readmeWrite' && !capabilities.readmeRead}
                  onChange={e => dispatch({ type: 'toggleCapability', cap: key, value: e.target.checked })}
                />
              }
              title={label}
              help={help}
            />
          ))}
        </div>
      </fieldset>

      <h3 id={`${ids}-behavior`} className="form-section-heading">{translate("connectionForm.connectionBehavior")}</h3>
      <fieldset className="choice-group" aria-labelledby={`${ids}-behavior`}>
        <div className="choice-list">
          <Choice
            control={
              <input
                type="checkbox"
                aria-label={translate("connectionForm.allowDirectoryScans")}
                checked={scanEnabled}
                onChange={e => dispatch({ type: 'setField', field: 'scanEnabled', value: e.target.checked })}
              />
            }
            title={translate("connectionForm.allowDirectoryScans")}
            help={
              <>
                {translate("connectionForm.countsObjectsAndTheirTotalSizeUnderA")}</>
            }
          />
          {isEdit && (
            <ValueChoice
              control={
                <select
                  aria-label={translate("connectionForm.scanPageSize")}
                  value={scanPageSize}
                  disabled={!scanEnabled}
                  onChange={e => dispatch({
                    type: 'setField', field: 'scanPageSize', value: Number(e.target.value) as FormState['scanPageSize'],
                  })}
                >
                  <option value={100}>{translate("connectionForm.100Items")}</option>
                  <option value={250}>{translate("connectionForm.250Items")}</option>
                  <option value={500}>{translate("connectionForm.500Items")}</option>
                  <option value={1000}>{translate("connectionForm.1000Items")}</option>
                </select>
              }
              title={translate("connectionForm.scanPageSize")}
              help={translate("connectionForm.objectsFetchedPerS3ListingRequestTheDefault")}
            />
          )}
          {isEdit && (
            <Choice
              control={
                <input
                  type="checkbox"
                  aria-label={translate("connectionForm.allowBucketCapacityScans")}
                  checked={capacityMetricsEnabled}
                  disabled={!scanEnabled}
                  onChange={e => dispatch({ type: 'setField', field: 'capacityMetricsEnabled', value: e.target.checked })}
                />
              }
              title={translate("connectionForm.allowBucketCapacityScans")}
              help={translate("connectionForm.allowsCapacityAndObjectCountsToBeCollected")}
            />
          )}
          {isEdit && (
            <Choice
              control={
                <input
                  type="checkbox"
                  aria-label={translate("connectionForm.measureAllBucketsPeriodically")}
                  checked={capacityTrackingEnabled}
                  disabled={!scanEnabled || !capacityMetricsEnabled}
                  onChange={e => dispatch({ type: 'setField', field: 'capacityTrackingEnabled', value: e.target.checked })}
                />
              }
              title={translate("connectionForm.measureAllBucketsPeriodically")}
              help={translate("connectionForm.recordsCapacityAndObjectCountsForEveryBucket")}
            />
          )}
          {isEdit && (
            <ValueChoice
              control={
                <select
                  aria-label={translate("connectionForm.capacityMeasurementInterval")}
                  value={capacityTrackingIntervalSeconds}
                  disabled={!scanEnabled || !capacityMetricsEnabled || !capacityTrackingEnabled}
                  onChange={e => dispatch({
                    type: 'setField', field: 'capacityTrackingIntervalSeconds', value: Number(e.target.value),
                  })}
                >
                  {getCapacityIntervals().map(([seconds, label]) => <option key={seconds} value={seconds}>{label}</option>)}
                </select>
              }
              title={translate("connectionForm.capacityMeasurementInterval")}
              help={translate("connectionForm.theDefaultIs24HoursTheSameInterval")}
            />
          )}
          <ValueChoice
            control={
              <input
                type="number"
                min={1}
                aria-label={translate("connectionForm.listingCacheLifetimeInSeconds")}
                value={listCacheTtlSec}
                onChange={e => dispatch({
                  type: 'setField', field: 'listCacheTtlSec', value: Number(e.target.value),
                })}
              />
            }
            title={translate("connectionForm.listingCacheLifetimeSeconds")}
            help={
              <>
                {translate("connectionForm.default8640024HoursHowLongTheServer")}</>
            }
          />
        </div>
      </fieldset>

      {/* 転送見積もりのプロファイル (spec: 2026-08-22-transfer-estimate-design.md)。
          作成時は出さない — 既定 (エンドポイントからの推定) で見積もりは出るので、
          接続を足す時点で決めさせる必要が無い。 */}
      {isEdit && current && (
        <>
          <h3 id={`${ids}-pricing`} className="form-section-heading">{translate("connectionForm.transferEstimate")}</h3>
          <fieldset className="choice-group" aria-labelledby={`${ids}-pricing`}>
            <p className="muted">
              {translate("connectionForm.usedByDirectorySummaryTransferEstimateEstimatesAre")}</p>
            <div className="choice-list">
              <ValueChoice
                control={
                  <select
                    aria-label={translate("connectionForm.provider")}
                    value={pricingProvider}
                    onChange={e => dispatch({
                      type: 'setField',
                      field: 'pricingProvider',
                      value: e.target.value as Provider | '',
                    })}
                  >
                    <option value="">
                      {translate("connectionForm.autoDetect")}{PROVIDER_LABELS[current.pricing.provider]})
                    </option>
                    {(Object.keys(PROVIDER_LABELS) as Provider[]).map(p => (
                      <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                    ))}
                  </select>
                }
                title={translate("connectionForm.provider")}
                help={
                  <>
                    {translate("connectionForm.pricingMethodByDefaultTheProviderIsInferred")}</>
                }
              />

              {(pricingProvider || current.pricing.provider) === 'aws' && (
                <ValueChoice
                  control={
                    <select
                      aria-label={translate("connectionForm.storageClass")}
                      value={pricingStorageClass}
                      onChange={e => dispatch({
                        type: 'setField',
                        field: 'pricingStorageClass',
                        value: e.target.value as StorageClassKey,
                      })}
                    >
                      {STORAGE_CLASS_OPTIONS.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  }
                  title={translate("connectionForm.storageClass")}
                  help={STORAGE_CLASS_OPTIONS.find(o => o.key === pricingStorageClass)?.help}
                />
              )}

              <ValueChoice
                control={
                  <input
                    type="number"
                    min={1}
                    aria-label={translate("connectionForm.readBandwidthMbS")}
                    value={pricingReadMbps}
                    onChange={e => dispatch({
                      type: 'setField', field: 'pricingReadMbps', value: Number(e.target.value),
                    })}
                  />
                }
                title={translate("connectionForm.readBandwidthMbS")}
                help={translate("connectionForm.speedWhenReadingFromThisConnectionMeasuredValues")}
              />

              <ValueChoice
                control={
                  <input
                    type="number"
                    min={1}
                    aria-label={translate("connectionForm.writeBandwidthMbS")}
                    value={pricingWriteMbps}
                    onChange={e => dispatch({
                      type: 'setField', field: 'pricingWriteMbps', value: Number(e.target.value),
                    })}
                  />
                }
                title={translate("connectionForm.writeBandwidthMbS")}
                help={translate("connectionForm.speedWhenWritingToThisConnectionTheSlower")}
              />

              <ValueChoice
                control={
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    aria-label={translate("connectionForm.variability")}
                    value={pricingInstability}
                    onChange={e => dispatch({
                      type: 'setField', field: 'pricingInstability', value: Number(e.target.value),
                    })}
                  />
                }
                title={translate("connectionForm.variability")}
                help={
                  <>
                    {translate("connectionForm.durationUncertaintyAValueOf05Makes")}</>
                }
              />

              <ValueChoice
                control={
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder={translate("common.notSet")}
                    aria-label={translate("connectionForm.capacityTb")}
                    value={pricingCapacityTb}
                    onChange={e => dispatch({
                      type: 'setField',
                      field: 'pricingCapacityTb',
                      value: e.target.value === '' ? '' : Number(e.target.value),
                    })}
                  />
                }
                title={translate("connectionForm.capacityTb")}
                help={translate("connectionForm.warnsWhenATransferWouldExceedCapacityLeave")}
              />

              <ValueChoice
                control={
                  <input
                    type="number"
                    min={0}
                    step={0.001}
                    placeholder={translate("connectionForm.useCatalogPricing")}
                    aria-label={translate("connectionForm.overrideStoragePriceGbMonth")}
                    value={pricingStoragePerGbMonth}
                    onChange={e => dispatch({
                      type: 'setField',
                      field: 'pricingStoragePerGbMonth',
                      value: e.target.value === '' ? '' : Number(e.target.value),
                    })}
                  />
                }
                title={translate("connectionForm.overrideStoragePriceGbMonth")}
                help={
                  <>
                    {translate("connectionForm.enterYourActualContractPriceIfAvailableOtherwise")}</>
                }
              />
            </div>

            <p className="muted choice-group__note">
              {current.pricing.ratesResolved ? (
                current.pricing.effective.storagePerGbMonth === null
                  ? translate("connectionForm.thisConnectionIsTreatedAsHavingNoCost")
                  : <>
                      {translate("connectionForm.currentPrice")}{current.pricing.effective.storagePerGbMonth}{translate("connectionForm.gbMonthPut")}{current.pricing.effective.putPer1000}{translate("connectionForm.1000Retrieval")}{current.pricing.effective.retrievalPerGb}/GB
                      {current.pricing.effective.minDurationDays > 0
                        && translate("connectionForm.minimumRetentionDays", { value0: current.pricing.effective.minDurationDays })}
                      {current.pricing.effective.storageRateSource === 'proxy'
                        && translate("connectionForm.storagePriceIsAnEstimate")}
                      {current.pricing.effective.storageRateSource === 'manual'
                        && translate("connectionForm.manuallyMaintainedUpdatePricingDoesNotChangeIt")}
                      {current.pricing.effective.storageRateSource === 'override'
                        && translate("connectionForm.priceOverriddenForThisConnection")}
                    </>
              ) : (
                translate("connectionForm.pricingForRegionIsNotAvailableInThe", {
                  value0: current.pricing.region ?? translate('connectionForm.unknown'),
                }) + translate('connectionForm.theCostIsDisplayedAs0WhichDoes')
              )}
            </p>
          </fieldset>
        </>
      )}

      {error && <p className="notice error" aria-live="polite">{localizeMessage(error)}</p>}
    </>
  )

  const actions = (
    <>
      <button type="button" className="button" onClick={onClose} disabled={saving}>{translate("common.cancel")}</button>
      <button type="button" className="button primary" onClick={() => void submit()} disabled={saving}>
        {saving ? translate("common.saving") : translate("common.save")}
      </button>
    </>
  )

  if (presentation === 'page') {
    return (
      <section className="connection-form" aria-labelledby={titleId}>
        <div className="section-heading">
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="connection-form__body">{fields}</div>
        <div className="connection-form__actions">{actions}</div>
      </section>
    )
  }

  return (
    <Dialog
      titleId={titleId}
      title={title}
      onClose={onClose}
      dismissible={!saving}
      size="wide"
      footer={actions}
    >
      <div className="dialog-body connection-form__body">{fields}</div>
    </Dialog>
  )
}
