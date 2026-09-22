import { useEffect, useState } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { isNewModel, sortModels, type GoModel } from '../models-contract.ts'
import type { OpencodeGoModelLimit, OpencodeGoModelLimits, OpencodeGoModels } from './section-controller.ts'
import type { en } from './locales.ts'
import css from './Section.module.css'

type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string
export function hasCapacityOverride(limit: OpencodeGoModelLimit | null | undefined): boolean {
  return limit?.contextWindow != null || limit?.maxTokens != null
}

/** One gateway-backed list and its selected model's staged capacity settings. */
export function ModelEditor({ models, draft, t, disabled, onEdit }: {
  models: OpencodeGoModels
  draft: OpencodeGoModelLimits
  t: Translate
  disabled: boolean
  onEdit: (next: OpencodeGoModelLimits) => void
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
    {isNewModel(entry, now) ? <span className={css.newBadge} title={t('newHint')}>NEW</span> : null}
    {entry.deprecated ? <Tag tone="warning">{t('deprecatedBadge')}</Tag> : null}
  </>
  return (
    <div className={css.limitsEditor}>
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
            {entries.map(entry => <button key={entry.id} type="button" className={css.modelChoice}
              aria-pressed={entry.id === model.id} onClick={() => { setSelected(entry.id) }}>
              <span className={css.modelName}>{entry.name ?? entry.id} {badges(entry)}</span>
              <code className={css.limitsModelId} translate="no">{entry.id}</code>
              {isNewModel(entry, now) ? <span className={css.releaseDate}>{t('releasedOn', { date: entry.releaseDate })}</span> : null}
            </button>)}
          </nav>
          <section className={css.modelDetails} aria-label={t('modelDetails')}>
            <div className={css.modelHeading}>
              <h3>{model.name ?? model.id}</h3>
              {badges(model)}
            </div>
            <code className={css.limitsModelId} translate="no">{model.id}</code>
            {model.deprecated ? <p className={css.hint}>{t('deprecatedHint')}</p> : null}
            <Capacity model={model} field="contextWindow" limit={draft[model.id]} t={t} disabled={disabled} onChange={write} />
            <Capacity model={model} field="maxTokens" limit={draft[model.id]} t={t} disabled={disabled} onChange={write} />
            {hasCapacityOverride(draft[model.id]) ? <button type="button" className={css.reset} disabled={disabled}
              onClick={() => { onEdit({ ...draft, [model.id]: null }) }}>{t('limitsResetModel')}</button> : null}
            {model.releaseDate ? <p className={css.hint}>{t('releaseSource', { date: model.releaseDate })}</p> : null}
            <p className={css.hint}>{t('limitsHint')}</p>
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

function Capacity({ model, field, limit, disabled, t, onChange }: {
  model: GoModel
  field: keyof OpencodeGoModelLimit
  limit: OpencodeGoModelLimit | null | undefined
  disabled: boolean
  t: Translate
  onChange: (id: string, field: keyof OpencodeGoModelLimit, value: number | undefined) => void
}) {
  const id = `opencode-go-${field}-${encodeURIComponent(model.id)}`
  const defaultValue = model[field]
  return <div className={css.field}>
    <label className={css.label} htmlFor={id}>{t(field === 'contextWindow' ? 'limitsContext' : 'limitsOutput')}</label>
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
      {t('capacityDefault', { value: defaultValue === undefined ? t('capacityMissing') : defaultValue.toLocaleString('en-US') })}
      {limit?.[field] != null ? ` · ${t('overridden')}` : ''}
    </span>
  </div>
}
