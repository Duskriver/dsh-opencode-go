import { useEffect, useState } from 'react'
import { Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { INPUT_MODALITIES, isModelEnabled, isNewModel, sortModels, type GoModel, type InputModality } from '../models-contract.ts'
import type { OpencodeGoModelLimit, OpencodeGoModelLimits, OpencodeGoModels } from './section-controller.ts'
import type { en } from './locales.ts'
import css from './Section.module.css'

type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string

/** Chip copy for each token models.dev can declare. */
const MODALITY_COPY = {
  text: 'modalityText', image: 'modalityImage', audio: 'modalityAudio',
  video: 'modalityVideo', pdf: 'modalityPdf',
} as const satisfies Record<InputModality, keyof typeof en>

export function hasCapacityOverride(limit: OpencodeGoModelLimit | null | undefined): boolean {
  return limit?.contextWindow != null || limit?.maxTokens != null
}

/** Per-model switches apply immediately; capacity edits stay in the staged form. */
export function ModelEditor({ models, draft, modelVisibility, t, locale, disabled, visibilitySaving, onEdit, onModelEnabled }: {
  models: OpencodeGoModels
  draft: OpencodeGoModelLimits
  modelVisibility: Readonly<Record<string, boolean>>
  t: Translate
  locale?: string
  disabled: boolean
  visibilitySaving: boolean
  onEdit: (next: OpencodeGoModelLimits) => void
  onModelEnabled: (id: string, enabled: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string>()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, 60_000)
    return () => { clearInterval(timer) }
  }, [])
  // Saved overrides never establish membership: only a successful gateway listing does.
  const all = sortModels(models.status === 'ready' ? models.entries : [], now)
  const normalized = query.trim().toLocaleLowerCase()
  const entries = all.filter(model => `${model.name ?? ''} ${model.id}`.toLocaleLowerCase().includes(normalized)
    && (filter === 'all' || filter === 'new' && isNewModel(model, now)
      || filter === 'custom' && hasCapacityOverride(draft[model.id]) || filter === 'deprecated' && model.deprecated))
  const model = entries.find(entry => entry.id === selected) ?? entries[0]
  const visibilityDisabled = disabled || visibilitySaving
  const metadataUnavailable = models.status === 'ready' && models.sources?.metadata.error !== undefined
  const customized = all.filter(entry => hasCapacityOverride(draft[entry.id])).length
  const filters = [
    ['all', 'filterAll', all.length],
    ['new', 'filterNew', all.filter(entry => isNewModel(entry, now)).length],
    ['custom', 'filterCustom', customized],
    ['deprecated', 'filterDeprecated', all.filter(entry => entry.deprecated).length],
  ] as const
  const write = (id: string, field: keyof OpencodeGoModelLimit, value: number | undefined): void => {
    const current = draft[id] === null ? { contextWindow: null, maxTokens: null } : draft[id] ?? {}
    onEdit({ ...draft, [id]: { ...current, [field]: value ?? null } })
  }
  const badges = (entry: GoModel) => <>
    {entry.configurationMissing ? <Tag tone="warning">{t(metadataUnavailable ? 'configurationUnavailable' : 'configurationMissing')}</Tag> : null}
    {isNewModel(entry, now) ? <span className={css.newBadge} title={t('newHint')}>{t('newBadge')}</span> : null}
    {entry.deprecated ? <Tag tone="warning">{t('deprecatedBadge')}</Tag> : null}
  </>
  return (
    <div className={css.limitsEditor}>
      <p className={css.hint}>{t('visibilityHint')}</p>
      <label className={css.visuallyHidden} htmlFor="opencode-go-model-filter">{t('limitsFilterLabel')}</label>
      <input id="opencode-go-model-filter" className={css.input} type="search" autoComplete="off"
        placeholder={t('limitsFilterPlaceholder')} value={query} onChange={event => { setQuery(event.target.value) }} />
      <div className={css.filters} role="group" aria-label={t('filterLabel')}>
        {filters.map(([key, label, count]) => <button key={key} type="button" className={css.filter}
          aria-pressed={filter === key} onClick={() => { setFilter(key) }}>{t(label)} <span>{count}</span></button>)}
      </div>
      {model ? (
        <div className={css.modelLayout}>
          <nav className={css.modelList} aria-label={t('modelsLabel')}>
            {entries.map(entry => <div key={entry.id}
              className={entry.id === model.id ? `${css.modelRow} ${css.modelRowSelected}` : css.modelRow}>
              <button type="button" className={css.modelChoice}
                aria-pressed={entry.id === model.id} onClick={() => { setSelected(entry.id) }}>
                <span className={css.modelName}>{entry.name ?? entry.id} {badges(entry)}</span>
                <code className={css.modelIdInline} translate="no">{entry.id}</code>
                {isNewModel(entry, now) ? <span className={css.releaseDate}>{t('releasedOn', { date: entry.releaseDate })}</span> : null}
              </button>
              {hasCapacityOverride(draft[entry.id])
                ? <span className={css.overrideDot} title={t('overridden')} aria-hidden="true" />
                : null}
              <Switch label={t('modelVisibleLabel', { name: entry.name ?? entry.id })}
                checked={isModelEnabled(entry, modelVisibility)} disabled={visibilityDisabled || entry.configurationMissing}
                onChange={enabled => { onModelEnabled(entry.id, enabled) }} />
            </div>)}
          </nav>
          <section className={css.modelDetails} aria-label={t('modelDetails')}>
            <div className={css.modelHeading}>
              <h3>{model.name ?? model.id}</h3>
              {badges(model)}
            </div>
            <code className={css.limitsModelId} translate="no">{model.id}</code>
            {model.configurationMissing ? <p className={css.hint}>{t(metadataUnavailable ? 'configurationUnavailableHint' : 'configurationMissingHint')}</p> : <>
              {model.deprecated ? <p className={css.hint}>{t('deprecatedHint')}</p> : null}
              <div className={css.stats}>
                <Capacity model={model} field="contextWindow" limit={draft[model.id]} t={t} locale={locale} disabled={disabled} onChange={write} />
                <Capacity model={model} field="maxTokens" limit={draft[model.id]} t={t} locale={locale} disabled={disabled} onChange={write} />
                <div className={css.stat}>
                  <span className={css.statLabel}>{t('modalityLabel')}</span>
                  <Modalities model={model} t={t} />
                </div>
              </div>
              {hasCapacityOverride(draft[model.id]) ? <button type="button" className={css.reset} disabled={disabled}
                onClick={() => { onEdit({ ...draft, [model.id]: null }) }}>{t('limitsResetModel')}</button> : null}
              {model.releaseDate ? <p className={css.hint}>{t('releaseSource', { date: model.releaseDate })}</p> : null}
              <p className={css.paneFoot}>
                {t('limitsHint')} {t('modalitiesSource')}
                {/* Only models declaring more than text and images need the caveat. */}
                {model.inputModalities?.some(modality => modality !== 'text' && modality !== 'image') === true
                  ? ` ${t('modalitiesForwarding')}` : ''}
              </p>
            </>}
          </section>
        </div>
      ) : models.status === 'ready' && all.length > 0 ? <p className={css.hint}>{t('limitsNoMatches', { query })}</p> : null}
      <div className={css.head}>
        <span className={css.limitsSummary}>{t('limitsSummary', { count: customized })}</span>
        {Object.values(draft).some(hasCapacityOverride) ? <button type="button" className={css.reset} disabled={disabled}
          onClick={() => { onEdit(Object.fromEntries(Object.keys(draft).map(id => [id, null]))) }}>{t('limitsResetAll')}</button> : null}
      </div>
    </div>
  )
}

/**
 * Declared input modalities as chips, in catalog order. An undeclared modality
 * stays visible but dashed: the model simply does not accept that input.
 */
function Modalities({ model, t }: { model: GoModel; t: Translate }) {
  const declared = model.inputModalities
  if (declared === undefined || declared.length === 0) return <span className={css.hint}>{t('modalityUnknown')}</span>
  return <span className={css.modalities}>
    {INPUT_MODALITIES.map(modality => <span key={modality}
      className={declared.includes(modality) ? css.modality : css.modalityOff}>
      {t(MODALITY_COPY[modality])}
    </span>)}
  </span>
}

function Capacity({ model, field, limit, disabled, t, locale, onChange }: {
  model: GoModel
  field: keyof OpencodeGoModelLimit
  limit: OpencodeGoModelLimit | null | undefined
  disabled: boolean
  t: Translate
  locale?: string
  onChange: (id: string, field: keyof OpencodeGoModelLimit, value: number | undefined) => void
}) {
  const id = `opencode-go-${field}-${encodeURIComponent(model.id)}`
  const defaultValue = model[field]
  return <div className={css.stat}>
    <label className={css.statLabel} htmlFor={id}>{t(field === 'contextWindow' ? 'limitsContext' : 'limitsOutput')}</label>
    <input id={id} className={css.input} type="number" min={1} step={1} inputMode="numeric"
      aria-label={t(field === 'contextWindow' ? 'limitsContextLabel' : 'limitsOutputLabel', { name: model.name ?? model.id })}
      aria-describedby={`${id}-default`} value={limit?.[field] ?? ''}
      placeholder={defaultValue === undefined ? t('capacityMissing') : String(defaultValue)} disabled={disabled}
      onChange={event => {
        const text = event.target.value.trim()
        const value = Number(text)
        if (text === '') onChange(model.id, field, undefined)
        else if (Number.isSafeInteger(value) && value > 0) onChange(model.id, field, value)
      }} />
    <span id={`${id}-default`} className={css.hint}>
      {t('capacityDefault', { value: defaultValue === undefined ? t('capacityMissing') : defaultValue.toLocaleString(locale) })}
      {limit?.[field] != null ? ` · ${t('overridden')}` : ''}
    </span>
  </div>
}
