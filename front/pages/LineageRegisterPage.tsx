import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CircleCheck, Info } from 'lucide-react'
import { api } from '../lib/api/client'
import type {
  Connection,
  RegistryDatasetSummary,
  ManualDatasetRegistrationInput,
  ManualLineageRegistrationInput,
  ManualStorageLocationInput,
  ManualTransformationInput,
} from '../lib/api/types'
import { useAuth } from '../lib/auth-context'
import {
  DatasetPicker,
  VersionListPicker,
  VersionPicker,
  type VersionChoice,
} from '../components/lineage/ManualLineagePicker'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

type RegistrationKind = 'dataset' | 'location' | 'run'

const REGISTRATION_KINDS: Array<{ value: RegistrationKind; label: string }> = [
  { value: 'dataset', get label() { return translate('common.dataset') } },
  { value: 'location', get label() { return translate('common.storageLocations') } },
  { value: 'run', get label() { return translate('lineageRegisterPage.processingHistory') } },
]

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? '').trim()
}

function optional(form: FormData, name: string): string | undefined {
  return text(form, name) || undefined
}

function lines(value: string): string[] {
  return value.split(/[\n,]/).map(item => item.trim()).filter(Boolean)
}

function evidence(form: FormData): string[] {
  return lines(text(form, 'evidenceRefs'))
}

function storageInput(form: FormData): ManualStorageLocationInput {
  return {
    connectionId: text(form, 'connectionId'),
    bucket: text(form, 'bucket'),
    key: text(form, 'key'),
    status: text(form, 'status') as ManualStorageLocationInput['status'],
    isPrimary: form.get('isPrimary') === 'on',
  }
}

function transformation(form: FormData): ManualTransformationInput {
  return {
    transformationKey: text(form, 'transformationKey'),
    name: text(form, 'transformationName'),
    description: optional(form, 'transformationDescription'),
    codeRepository: optional(form, 'codeRepository'),
    defaultCodeRef: optional(form, 'defaultCodeRef'),
  }
}

function occurredAt(form: FormData): string | undefined {
  const raw = text(form, 'occurredAt')
  return raw ? new Date(raw).toISOString() : undefined
}

function ConnectionLocationFields({ connections }: { connections: Connection[] }) {
  useLocale()
  return (
    <div className="lineage-form-grid lineage-form-grid--3">
      <label className="field">
        <span>{translate('common.connection')}</span>
        <select name="connectionId" required defaultValue="">
          <option value="" disabled>{translate('lineageRegisterPage.selectAConnection')}</option>
          {connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{translate('common.bucket')}</span>
        <input name="bucket" required placeholder="dataset" />
      </label>
      <label className="field">
        <span>{translate('lineageRegisterPage.path')}</span>
        <input name="key" placeholder="podcast/raw/" />
      </label>
      <label className="field">
        <span>{translate('common.status')}</span>
        <select name="status" defaultValue="available">
          <option value="available">{translate('common.available')}</option>
          <option value="archived">{translate('common.archived')}</option>
          <option value="missing">{translate('lineageRegisterPage.notFound')}</option>
          <option value="unknown">{translate('common.unknown')}</option>
        </select>
      </label>
      <label className="checkbox-field lineage-form-wide"><input name="isPrimary" type="checkbox" /> {translate('lineageRegisterPage.setAsPrimaryStorageLocation')}</label>
    </div>
  )
}

function EvidenceField() {
  useLocale()
  return (
    <label className="field">
      <span>{translate('lineageRegisterPage.evidenceUrls')}</span>
      <textarea name="evidenceRefs" rows={3} placeholder={translate('lineageRegisterPage.readmesNotionPagesOrPurchaseRecordsOnePer')} />
    </label>
  )
}

// 登録の種類ごとの使いどころ。フォームの先頭に出す。
function Guidance({ title, children }: { title: string; children: string }) {
  useLocale()
  return (
    <div className="notice lineage-guidance">
      <Info size={16} aria-hidden="true" />
      <span><strong>{title}</strong>{children}</span>
    </div>
  )
}

function ResultNotice({ message, to }: { message: string; to?: string }) {
  useLocale()
  return (
    <div className="notice success" role="status">
      <CircleCheck size={16} aria-hidden="true" />
      <span>{message}</span>
      {to && <Link to={to}>{translate('lineageRegisterPage.viewRegistrationDetails')}</Link>}
    </div>
  )
}

function DatasetRegistrationForm({ connections }: { connections: Connection[] }) {
  useLocale()
  const [target, setTarget] = useState<'new' | 'existing'>('new')
  const [dataset, setDataset] = useState<RegistryDatasetSummary | null>(null)
  const [withLocation, setWithLocation] = useState(true)
  const [withSource, setWithSource] = useState(false)
  const [withProcessing, setWithProcessing] = useState(false)
  const [inputs, setInputs] = useState<VersionChoice[]>([])
  const [timeStatus, setTimeStatus] = useState<'known' | 'unknown'>('unknown')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultVersionId, setResultVersionId] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (target === 'existing' && !dataset?.datasetId) {
      setError(translate('lineageRegisterPage.selectAnExistingDataset'))
      return
    }
    const form = new FormData(event.currentTarget)
    const input: ManualDatasetRegistrationInput = {
      ...(target === 'new' ? { dataset: {
        datasetKey: text(form, 'datasetKey'), namespace: text(form, 'namespace'), name: text(form, 'name'),
        displayName: optional(form, 'displayName'), aliases: lines(text(form, 'aliases')),
        description: optional(form, 'description'), mediaType: optional(form, 'mediaType'), owner: optional(form, 'owner'),
      } } : { datasetId: dataset!.datasetId! }),
      version: {
        version: text(form, 'version'), contentHash: optional(form, 'contentHash'),
        manifestUri: optional(form, 'manifestUri'), manifestHash: optional(form, 'manifestHash'),
        schemaUri: optional(form, 'schemaUri'),
      },
      ...(withLocation ? { location: storageInput(form) } : {}),
      ...(withSource ? { source: {
        sourceKey: text(form, 'sourceKey'),
        kind: text(form, 'sourceKind') as NonNullable<ManualDatasetRegistrationInput['source']>['kind'],
        name: text(form, 'sourceName'), uri: optional(form, 'sourceUri'), vendor: optional(form, 'vendor'),
        product: optional(form, 'product'), licenseRef: optional(form, 'licenseRef'), contractRef: optional(form, 'contractRef'),
      } } : {}),
      ...(withProcessing ? { processing: {
        transformation: transformation(form), inputVersionIds: inputs.map(item => item.id),
        jobNamespace: text(form, 'jobNamespace'), jobName: text(form, 'jobName'),
        gitSha: optional(form, 'gitSha'), containerDigest: optional(form, 'containerDigest'),
        configUri: optional(form, 'configUri'), configHash: optional(form, 'configHash'),
        executionTimeStatus: timeStatus, occurredAt: timeStatus === 'known' ? occurredAt(form) : undefined,
      } } : {}),
      evidenceRefs: evidence(form),
    }
    setSaving(true)
    setError(null)
    try {
      const result = await api.registerManualDataset(input)
      const version = result.version as Record<string, unknown> | undefined
      setResultVersionId(typeof version?.id === 'string' ? version.id : null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : translate('lineageRegisterPage.couldNotRegister'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="lineage-register-form" onSubmit={submit}>
      <section className="lineage-form-section">
        <div className="section-heading"><h2>{translate('common.dataset')}</h2></div>
        <div className="lineage-segmented lineage-form-switch" role="group" aria-label={translate('lineageRegisterPage.datasetRegistrationMethod')}>
          <button type="button" aria-pressed={target === 'new'} onClick={() => { setTarget('new'); setDataset(null) }}>{translate('lineageRegisterPage.createNew')}</button>
          <button type="button" aria-pressed={target === 'existing'} onClick={() => setTarget('existing')}>{translate('lineageRegisterPage.addAVersionToAnExistingDataset')}</button>
        </div>
        {target === 'existing' ? <DatasetPicker value={dataset} onChange={setDataset} /> : (
          <div className="lineage-form-grid">
            <label className="field"><span>{translate('common.displayName')}</span><input name="displayName" required placeholder={translate('lineageRegisterPage.japanesePodcastSource')} /></label>
            <label className="field"><span>{translate('common.datasetKey')}</span><input name="datasetKey" required placeholder="podcast/ja/raw" /></label>
            <label className="field"><span>{translate('common.namespace')}</span><input name="namespace" required placeholder="mdx-speech" /></label>
            <label className="field"><span>{translate('common.technicalName')}</span><input name="name" required placeholder="podcast/ja/raw" /></label>
            <label className="field"><span>{translate('common.dataFormat')}</span><input name="mediaType" placeholder="audio" /></label>
            <label className="field"><span>{translate('common.administrator')}</span><input name="owner" /></label>
            <label className="field lineage-form-wide"><span>{translate('common.aliases')}</span><input name="aliases" placeholder={translate('lineageRegisterPage.podcastJaJapanesePodcast')} /></label>
            <label className="field lineage-form-wide"><span>{translate('common.description')}</span><textarea name="description" rows={3} /></label>
          </div>
        )}
      </section>

      <section className="lineage-form-section">
        <div className="section-heading"><h2>{translate('common.version')}</h2></div>
        <div className="lineage-form-grid">
          <label className="field"><span>{translate('common.version')}</span><input name="version" required placeholder="2026-08-27" /></label>
          <label className="field"><span>{translate('common.contentHash')}</span><input name="contentHash" placeholder="sha256:..." /></label>
          <label className="field"><span>{translate('common.fileManifestUri')}</span><input name="manifestUri" placeholder="s3://.../manifest.jsonl" /></label>
          <label className="field"><span>{translate('common.fileManifestHash')}</span><input name="manifestHash" placeholder="sha256:..." /></label>
          <label className="field lineage-form-wide"><span>{translate('common.schemaUri')}</span><input name="schemaUri" /></label>
        </div>
      </section>

      <section className="lineage-form-section">
        <div className="section-heading"><h2>{translate('common.storageLocations')}</h2></div>
        <label className="checkbox-field"><input type="checkbox" checked={withLocation} onChange={event => setWithLocation(event.target.checked)} /> {translate('lineageRegisterPage.alsoRegisterAStorageLocation')}</label>
        {withLocation && <div className="lineage-form-subsection"><ConnectionLocationFields connections={connections} /></div>}
      </section>

      <section className="lineage-form-section">
        <div className="section-heading"><h2>{translate('lineageRegisterPage.provenanceAndProcessing')}</h2></div>
        <label className="checkbox-field"><input type="checkbox" checked={withSource} onChange={event => setWithSource(event.target.checked)} /> {translate('lineageRegisterPage.recordPurchaseOrCollectionSource')}</label>
        {withSource && (
          <div className="lineage-form-subsection">
            <div className="lineage-form-grid">
              <label className="field"><span>{translate('lineageRegisterPage.sourceKey')}</span><input name="sourceKey" required placeholder="vendor/corpus-name" /></label>
              <label className="field"><span>{translate('common.type')}</span><select name="sourceKind" defaultValue="purchased"><option value="purchased">{translate('common.purchased')}</option><option value="crawled">{translate('common.collected')}</option><option value="provided">{translate('common.provided')}</option><option value="database">{translate('common.database')}</option><option value="generated">{translate('common.generated')}</option><option value="other">{translate('common.other')}</option></select></label>
              <label className="field"><span>{translate('lineageRegisterPage.name')}</span><input name="sourceName" required /></label>
              <label className="field"><span>{translate('lineageRegisterPage.uri')}</span><input name="sourceUri" placeholder="https://..." /></label>
              <label className="field"><span>{translate('common.provider')}</span><input name="vendor" /></label>
              <label className="field"><span>{translate('common.productName')}</span><input name="product" /></label>
              <label className="field"><span>{translate('common.licenseReference')}</span><input name="licenseRef" /></label>
              <label className="field"><span>{translate('common.contractReference')}</span><input name="contractRef" /></label>
            </div>
          </div>
        )}
        <label className="checkbox-field"><input type="checkbox" checked={withProcessing} onChange={event => setWithProcessing(event.target.checked)} /> {translate('lineageRegisterPage.recordTheProcessThatProducedThisVersion')}</label>
        {withProcessing && (
          <div className="lineage-form-subsection">
            <VersionListPicker values={inputs} onChange={setInputs} label={translate('lineageRegisterPage.inputData')} />
            <div className="lineage-form-grid">
              <label className="field"><span>{translate('lineageRegisterPage.processingName')}</span><input name="transformationName" required placeholder={translate('lineageRegisterPage.neMoCuratorQualityFilter')} /></label>
              <label className="field"><span>{translate('lineageRegisterPage.processingKey')}</span><input name="transformationKey" required placeholder="nemo-curator-quality-filter" /></label>
              <label className="field"><span>{translate('lineageRegisterPage.processingNamespace')}</span><input name="jobNamespace" required placeholder="mdx-speech" /></label>
              <label className="field"><span>{translate('lineageRegisterPage.processingTechnicalName')}</span><input name="jobName" required placeholder="nemo-curator-quality-filter" /></label>
              <label className="field"><span>{translate('lineageRegisterPage.codeRepository')}</span><input name="codeRepository" placeholder="https://github.com/..." /></label>
              <label className="field"><span>{translate('lineageRegisterPage.defaultCodeReference')}</span><input name="defaultCodeRef" placeholder="commit / tag" /></label>
              <label className="field"><span>{translate('lineageRegisterPage.gitSha')}</span><input name="gitSha" /></label>
              <label className="field"><span>{translate('common.containerImage')}</span><input name="containerDigest" /></label>
              <label className="field"><span>{translate('common.configurationFileUri')}</span><input name="configUri" /></label>
              <label className="field"><span>{translate('common.configurationFileHash')}</span><input name="configHash" /></label>
              <label className="field"><span>{translate('lineageRegisterPage.executionTime')}</span><select value={timeStatus} onChange={event => setTimeStatus(event.target.value as 'known' | 'unknown')}><option value="unknown">{translate('common.unknown')}</option><option value="known">{translate('lineageRegisterPage.known')}</option></select></label>
              {timeStatus === 'known' && <label className="field"><span>{translate('lineageRegisterPage.dateAndTime')}</span><input name="occurredAt" type="datetime-local" required /></label>}
            </div>
          </div>
        )}
        <EvidenceField />
      </section>

      <section className="lineage-form-section">
        <div className="section-heading"><h2>{translate('lineageRegisterPage.review')}</h2></div>
        <p className="muted">{translate('lineageRegisterPage.savingRegistersTheDataInTheRegistryIf')}</p>
        {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
        {resultVersionId && <ResultNotice message={translate('lineageRegisterPage.dataVersionRegistered')} to={`/lineage?mode=versions&versionId=${encodeURIComponent(resultVersionId)}`} />}
        <button className="button primary" type="submit" disabled={saving}>{saving ? translate('lineageRegisterPage.registering') : translate('lineageRegisterPage.register')}</button>
      </section>
    </form>
  )
}

function LocationRegistrationForm({ connections }: { connections: Connection[] }) {
  useLocale()
  const [version, setVersion] = useState<VersionChoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!version) return setError(translate('lineageRegisterPage.selectADataVersion'))
    const form = new FormData(event.currentTarget)
    setSaving(true); setError(null); setDone(false)
    try {
      await api.registerManualLocation({ versionId: version.id, location: storageInput(form), evidenceRefs: evidence(form) })
      setDone(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : translate('lineageRegisterPage.couldNotRegister'))
    } finally { setSaving(false) }
  }
  return (
    <form className="lineage-register-form" onSubmit={submit}>
      <Guidance title={translate('lineageRegisterPage.useThisWhenCopyingTheSameContentTo')}>{translate('lineageRegisterPage.addsAStorageLocationToTheSameVersion')}</Guidance>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('common.version')}</h2></div><VersionPicker value={version} onChange={setVersion} /></section>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('common.storageLocations')}</h2></div><ConnectionLocationFields connections={connections} /></section>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('lineageRegisterPage.evidence')}</h2></div><EvidenceField /></section>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('lineageRegisterPage.review')}</h2></div>
        {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
        {done && <ResultNotice message={translate('lineageRegisterPage.storageLocationAdded')} to={version ? `/lineage?mode=versions&versionId=${encodeURIComponent(version.id)}` : undefined} />}
        <button className="button primary" type="submit" disabled={saving}>{saving ? translate('lineageRegisterPage.registering') : translate('lineageRegisterPage.addStorageLocation')}</button>
      </section>
    </form>
  )
}

function RunRegistrationForm() {
  useLocale()
  const [inputs, setInputs] = useState<VersionChoice[]>([])
  const [outputs, setOutputs] = useState<VersionChoice[]>([])
  const [timeStatus, setTimeStatus] = useState<'known' | 'unknown'>('unknown')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inputs.length === 0 || outputs.length === 0) return setError(translate('lineageRegisterPage.selectAtLeastOneInputAndOneOutput'))
    if (inputs.some(input => outputs.some(output => output.id === input.id))) return setError(translate('lineageRegisterPage.theSameVersionCannotBeBothAnInput'))
    const form = new FormData(event.currentTarget)
    const input: ManualLineageRegistrationInput = {
      transformation: transformation(form), inputVersionIds: inputs.map(item => item.id), outputVersionIds: outputs.map(item => item.id),
      jobNamespace: text(form, 'jobNamespace'), jobName: text(form, 'jobName'), gitSha: optional(form, 'gitSha'),
      containerDigest: optional(form, 'containerDigest'), configUri: optional(form, 'configUri'), configHash: optional(form, 'configHash'),
      executionTimeStatus: timeStatus, occurredAt: timeStatus === 'known' ? occurredAt(form) : undefined, evidenceRefs: evidence(form),
    }
    setSaving(true); setError(null); setRunId(null)
    try {
      const result = await api.registerManualLineage(input)
      setRunId(typeof result.id === 'string' ? result.id : 'registered')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : translate('lineageRegisterPage.couldNotRegister'))
    } finally { setSaving(false) }
  }
  const outputLink = outputs[0] ? `/lineage?mode=versions&versionId=${encodeURIComponent(outputs[0].id)}` : undefined
  return (
    <form className="lineage-register-form" onSubmit={submit}>
      <Guidance title={translate('lineageRegisterPage.addProcessingHistoryBetweenExistingDatasets')}>{translate('lineageRegisterPage.leaveUnknownExecutionTimesUnknownDoNotRegister')}</Guidance>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('lineageRegisterPage.inputsAndOutputs')}</h2></div>
        <div className="lineage-form-grid lineage-form-grid--top"><VersionListPicker values={inputs} onChange={setInputs} label={translate('lineageRegisterPage.inputData')} /><VersionListPicker values={outputs} onChange={setOutputs} label={translate('lineageRegisterPage.outputData')} /></div>
      </section>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('common.processing')}</h2></div>
        <div className="lineage-form-grid">
          <label className="field"><span>{translate('lineageRegisterPage.processingName')}</span><input name="transformationName" required /></label>
          <label className="field"><span>{translate('lineageRegisterPage.processingKey')}</span><input name="transformationKey" required /></label>
          <label className="field"><span>{translate('lineageRegisterPage.processingNamespace')}</span><input name="jobNamespace" required /></label>
          <label className="field"><span>{translate('lineageRegisterPage.processingTechnicalName')}</span><input name="jobName" required /></label>
          <label className="field"><span>{translate('lineageRegisterPage.codeRepository')}</span><input name="codeRepository" /></label>
          <label className="field"><span>{translate('lineageRegisterPage.defaultCodeReference')}</span><input name="defaultCodeRef" /></label>
          <label className="field"><span>{translate('lineageRegisterPage.gitSha')}</span><input name="gitSha" /></label>
          <label className="field"><span>{translate('common.containerImage')}</span><input name="containerDigest" /></label>
          <label className="field"><span>{translate('common.configurationFileUri')}</span><input name="configUri" /></label>
          <label className="field"><span>{translate('common.configurationFileHash')}</span><input name="configHash" /></label>
          <label className="field"><span>{translate('lineageRegisterPage.executionTime')}</span><select value={timeStatus} onChange={event => setTimeStatus(event.target.value as 'known' | 'unknown')}><option value="unknown">{translate('common.unknown')}</option><option value="known">{translate('lineageRegisterPage.known')}</option></select></label>
          {timeStatus === 'known' && <label className="field"><span>{translate('lineageRegisterPage.dateAndTime')}</span><input name="occurredAt" type="datetime-local" required /></label>}
        </div>
      </section>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('lineageRegisterPage.evidence')}</h2></div><EvidenceField /></section>
      <section className="lineage-form-section"><div className="section-heading"><h2>{translate('lineageRegisterPage.review')}</h2></div>
        {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
        {runId && <ResultNotice message={translate('lineageRegisterPage.processingHistoryRegistered')} to={outputLink} />}
        <button className="button primary" type="submit" disabled={saving}>{saving ? translate('lineageRegisterPage.registering') : translate('common.registerProcessingHistory')}</button>
      </section>
    </form>
  )
}

export default function LineageRegisterPage() {
  useLocale()
  const { user } = useAuth()
  const [kind, setKind] = useState<RegistrationKind>('dataset')
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const allowed = user?.permissions.includes('lineage:curate') ?? false

  useEffect(() => {
    if (!allowed) return
    api.listConnections().then(setConnections, (reason: Error) => setConnectionError(reason.message))
  }, [allowed])

  if (!allowed) {
    return (
      <section className="lineage-register-page">
        <header className="page-header"><div><h1>{translate('section.dataLineage')}</h1></div></header>
        <p className="notice error">{translate('lineageRegisterPage.youDoNotHavePermissionToRegisterManually')}</p>
      </section>
    )
  }

  return (
    <section className="lineage-register-page touch-targets">
      <header className="page-header">
        <div><h1>{translate('section.dataLineage')}</h1></div>
        <div className="page-actions">
          <Link className="button" to="/lineage">
            <ArrowLeft size={16} aria-hidden="true" />
            {translate('lineageRegisterPage.backToList')}</Link>
        </div>
      </header>
      <nav className="tabs" aria-label={translate('lineageRegisterPage.registrationType')}>
        {REGISTRATION_KINDS.map(item => (
          <button
            key={item.value}
            type="button"
            className={kind === item.value ? 'tab active' : 'tab'}
            aria-pressed={kind === item.value}
            onClick={() => setKind(item.value)}
          >{item.label}</button>
        ))}
      </nav>
      {connectionError && <p className="notice error" role="alert">{localizeMessage(connectionError)}</p>}
      {kind === 'dataset' && <DatasetRegistrationForm connections={connections} />}
      {kind === 'location' && <LocationRegistrationForm connections={connections} />}
      {kind === 'run' && <RunRegistrationForm />}
    </section>
  )
}
