/**
 * The OpenCode Go settings section. It leads with the one value a user has to
 * supply — the API key, stored write-only through the credentials domain — and
 * the models the gateway currently serves, then keeps the credential
 * reference, the endpoint, and the adapter tuning fields in the
 * `llm-opencode-go` namespace behind a collapsed disclosure.
 */

import { useEffect, useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconChevronDownOutline14, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  OpencodeGoModelLimit,
  OpencodeGoModels,
  OpencodeGoSectionFace,
  OpencodeGoSectionState,
} from './section-controller.ts'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-api-remotes/client'
import type { en } from './locales.ts'
import css from './Section.module.css'

export type { OpencodeGoSectionState } from './section-controller.ts'

/** Section copy lookup, including the optional `{name}` template params. */
type SectionTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

/** Injected dependencies of {@link OpencodeGoSection} (slot `inject`). */
export interface OpencodeGoSectionInjected extends OpencodeGoSectionFace {
  /** Section copy. */
  t: SectionTranslate
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type OpencodeGoSectionProps = Partial<InjectFace<OpencodeGoSectionInjected>>

interface ValueFieldProps {
  id: string
  label: string
  hint: string
  field: OpencodeGoSectionState['baseURL']
  invalidLabel: string
  overriddenLabel: string
  resetLabel: string
  disabled: boolean
  numeric?: boolean
  onEdit: (text: string) => void
  onReset: () => void
}

/** One staged value field: label, override badge with reset, control, and hint. */
function ValueField(props: ValueFieldProps) {
  const hintId = `${props.id}-hint`
  return (
    <div className={css.field}>
      <div className={css.head}>
        <label className={css.label} htmlFor={props.id}>{props.label}</label>
        {props.field.overridden
          ? (
            <span className={css.badges}>
              <Tag tone="neutral">{props.overriddenLabel}</Tag>
              <button
                type="button"
                className={css.reset}
                disabled={props.disabled}
                onClick={props.onReset}
              >
                {props.resetLabel}
              </button>
            </span>
          )
          : null}
      </div>
      <input
        id={props.id}
        name={props.id}
        autoComplete="off"
        aria-describedby={hintId}
        className={props.field.invalid ? css.inputInvalid : css.input}
        type={props.numeric === true ? 'number' : 'text'}
        {...props.numeric === true ? { inputMode: 'numeric' as const } : {}}
        {...props.field.invalid ? { 'aria-invalid': true } : {}}
        value={props.field.text}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p id={hintId} className={props.field.invalid ? css.invalid : css.hint}>
        {props.field.invalid ? props.invalidLabel : props.hint}
      </p>
    </div>
  )
}

/**
 * The gateway's model listing in the state the page last read.
 * @param props.models - the listing state the controller published.
 * @param props.t - section copy.
 * @returns the listing body: a progress line, the Host diagnostic, or an empty
 *   body once the capacity table can show the complete model list.
 */
function ModelsBody({ models, t }: {
  models: OpencodeGoModels
  t: SectionTranslate
}) {
  if (models.status === 'failed') {
    return (
      <>
        <p className={css.failedNote} role="alert">{t('modelsFailed')}</p>
        <p className={css.hint}>{models.message}</p>
      </>
    )
  }
  if (models.status !== 'ready') return <p className={css.hint} role="status" aria-live="polite">{t('modelsLoading')}</p>
  if (models.count === 0) return <p className={css.hint}>{t('modelsEmpty')}</p>
  return null
}

/**
 * The searchable per-model capacity editor. It keeps the visible table backed
 * by the same staged JSON field as the rest of the form, so Save and Discard
 * retain one predictable write path.
 */
function LimitsTable({ models, draft, t, disabled, onEdit }: {
  models: OpencodeGoModels
  draft: Record<string, OpencodeGoModelLimit>
  t: SectionTranslate
  disabled: boolean
  onEdit: (next: Record<string, OpencodeGoModelLimit>) => void
}) {
  const [query, setQuery] = useState('')
  if (models.status !== 'ready' || models.count === 0) return <p className={css.hint}>{t('limitsEmpty')}</p>

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const entries = models.entries.filter((model) => {
    if (normalizedQuery === '') return true
    return `${model.name ?? ''} ${model.id}`.toLocaleLowerCase().includes(normalizedQuery)
  })
  const customizedCount = Object.keys(draft).length

  const write = (id: string, field: keyof OpencodeGoModelLimit, value: number | undefined): void => {
    const current = draft[id] ?? {}
    const merged = { ...current }
    if (value === undefined) delete merged[field]
    else merged[field] = value
    const next = { ...draft }
    if (merged.contextWindow === undefined && merged.maxTokens === undefined) delete next[id]
    else next[id] = merged
    onEdit(next)
  }
  const clearModel = (id: string): void => {
    const next = { ...draft }
    delete next[id]
    onEdit(next)
  }

  return (
    <div className={css.limitsEditor}>
      <div className={css.limitsToolbar}>
        <label className={css.limitsFilterLabel} htmlFor="opencode-go-model-filter">{t('limitsFilterLabel')}</label>
        <input
          id="opencode-go-model-filter"
          className={css.input}
          type="search"
          name="model-filter"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('limitsFilterPlaceholder')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
        <span className={css.limitsSummary} role="status" aria-live="polite">
          {t('limitsSummary', { count: customizedCount })}
        </span>
      </div>
      {entries.length === 0
        ? <p className={css.hint}>{t('limitsNoMatches', { query })}</p>
        : (
          <div className={css.limitsScroll}>
            <table className={css.limitsTable}>
              <caption className={css.visuallyHidden}>{t('limitsLabel')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('limitsModel')}</th>
                  <th scope="col">{t('limitsContext')}</th>
                  <th scope="col">{t('limitsOutput')}</th>
                  <th scope="col"><span className={css.visuallyHidden}>{t('limitsResetModel')}</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((model) => (
                  <LimitRow
                    key={model.id}
                    model={model}
                    limit={draft[model.id]}
                    disabled={disabled}
                    t={t}
                    onChange={write}
                    onReset={clearModel}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      {customizedCount > 0
        ? (
          <button type="button" className={css.reset} disabled={disabled} onClick={() => { onEdit({}) }}>
            {t('limitsResetAll')}
          </button>
        )
        : null}
    </div>
  )
}

/** One capacity row with catalog reference values and accessible numeric inputs. */
function LimitRow({ model, limit, disabled, t, onChange, onReset }: {
  model: LlmDiscoveredModel
  limit: OpencodeGoModelLimit | undefined
  disabled: boolean
  t: SectionTranslate
  onChange: (id: string, field: keyof OpencodeGoModelLimit, value: number | undefined) => void
  onReset: (id: string) => void
}) {
  const name = model.name ?? model.id
  const contextId = `opencode-go-context-${inputKey(model.id)}`
  const outputId = `opencode-go-output-${inputKey(model.id)}`
  return (
    <tr>
      <th scope="row" className={css.limitsName}>
        <span className={css.limitsId} translate="no">{name}</span>
        {model.name !== undefined && model.name !== model.id
          ? <code className={css.limitsModelId} translate="no">{model.id}</code>
          : null}
        <span className={css.hint}>
          {t('limitsAdvertised', { context: capacityLabel(model.contextWindow), output: capacityLabel(model.maxTokens) })}
        </span>
      </th>
      <td>
        <label className={css.visuallyHidden} htmlFor={contextId}>{t('limitsContextLabel', { name })}</label>
        <input
          id={contextId}
          className={css.input}
          type="number"
          name={contextId}
          autoComplete="off"
          inputMode="numeric"
          min={1}
          step={1}
          value={limit?.contextWindow ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const text = event.target.value.trim()
            if (text === '') onChange(model.id, 'contextWindow', undefined)
            else {
              const value = positiveInteger(text)
              if (value !== undefined) onChange(model.id, 'contextWindow', value)
            }
          }}
        />
      </td>
      <td>
        <label className={css.visuallyHidden} htmlFor={outputId}>{t('limitsOutputLabel', { name })}</label>
        <input
          id={outputId}
          className={css.input}
          type="number"
          name={outputId}
          autoComplete="off"
          inputMode="numeric"
          min={1}
          step={1}
          value={limit?.maxTokens ?? ''}
          disabled={disabled}
          onChange={(event) => {
            const text = event.target.value.trim()
            if (text === '') onChange(model.id, 'maxTokens', undefined)
            else {
              const value = positiveInteger(text)
              if (value !== undefined) onChange(model.id, 'maxTokens', value)
            }
          }}
        />
      </td>
      <td>
        {limit !== undefined
          ? <button type="button" className={css.reset} disabled={disabled} onClick={() => { onReset(model.id) }}>{t('limitsResetModel')}</button>
          : null}
      </td>
    </tr>
  )
}

function positiveInteger(value: string): number | undefined {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}

function capacityLabel(value: number | undefined): string {
  return value === undefined ? '—' : String(value)
}

function inputKey(value: string): string {
  return encodeURIComponent(value)
}

/**
 * Render the OpenCode Go settings page.
 * @param props - locale copy, the page snapshot, and its form actions.
 * @returns the section.
 */
export function OpencodeGoSection(props: OpencodeGoSectionProps) {
  const { useOpencodeGo, edit, resetField, save, discard, loadModels, setEnabled, t } = props
  if (useOpencodeGo === undefined || edit === undefined || resetField === undefined
    || save === undefined || discard === undefined || loadModels === undefined
    || setEnabled === undefined || t === undefined) return null
  return (
    <Loaded
      state={useOpencodeGo(snapshot => snapshot)}
      t={t}
      edit={edit}
      resetField={resetField}
      save={save}
      discard={discard}
      loadModels={loadModels}
      setEnabled={setEnabled}
    />
  )
}

/** The page once every injected seat is present. */
function Loaded(props: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  edit: (field: string, text: string) => void
  resetField: (field: string) => void
  save: () => void
  discard: () => void
  loadModels: () => void
  setEnabled: (next: boolean) => void
}) {
  const { t, state, loadModels } = props
  const [advanced, setAdvanced] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  // The shell mounts only the open section, so a mount is the page being
  // opened: read the listing once, and let the button re-read it afterwards.
  useEffect(() => {
    if (state.available && state.models.status === 'idle') loadModels()
  }, [state.available, state.models.status, loadModels])
  if (!state.available) {
    return <p className={css.intro}>{t('unavailable')}</p>
  }
  const disabled = !state.writable
  const fieldProps = {
    invalidLabel: t('invalidValue'),
    overriddenLabel: t('overridden'),
    resetLabel: t('reset'),
    disabled,
  }
  const advancedOverridden = state.apiKeyEnv.overridden || state.baseURL.overridden
    || state.refreshMinutes.overridden || state.streamIdleTimeoutMs.overridden
    || state.maxRequestImageBytes.overridden || state.requestImagePixelBudget.overridden
    || state.requestImageMaxBytes.overridden
  const modelLimitsOverridden = Object.keys(state.modelLimitDraft).length > 0
  return (
    <div>
      <p className={css.intro}>{t('intro')}</p>
      <div className={css.field}>
        <div className={css.head}>
          <span className={css.label}>{t('enabledLabel')}</span>
          <Switch
            checked={state.enabled}
            label={t('enabledLabel')}
            // The settings document being read-only is what locks the switch;
            // the credential's own writability is unrelated to this field.
            disabled={disabled}
            onChange={props.setEnabled}
          />
        </div>
        <p className={css.hint}>{state.enabled ? t('enabledHint') : t('enabledOff')}</p>
      </div>
      <div className={css.field}>
        <div className={css.head}>
          <label className={css.label} htmlFor="opencode-go-key">{t('keyLabel')}</label>
          <span className={css.badges}>
            <Tag tone={state.apiKeyConfigured ? 'success' : 'warning'}>
              {state.apiKeyConfigured ? t('keyConfigured') : t('keyMissing')}
            </Tag>
          </span>
        </div>
        <input
          id="opencode-go-key"
          name="api-key"
          className={css.input}
          type="password"
          autoComplete="off"
          aria-describedby="opencode-go-key-hint"
          value={state.apiKey.text}
          // The credentials domain accepts a key even when the settings document
          // itself is read-only; its own writability is what disables this
          // control — a key sourced from the environment cannot be written here.
          disabled={!state.apiKeyWritable}
          onChange={(event) => { props.edit('apiKey', event.target.value) }}
        />
        <p id="opencode-go-key-hint" className={css.hint}>{state.apiKeyWritable ? t('keyHint') : t('keyNotWritable')}</p>
      </div>
      <div className={css.field}>
        <div className={css.head}>
          <span className={css.label}>{t('modelsLabel')}</span>
          <span className={css.badges}>
            {state.models.status === 'ready'
              ? <Tag tone="neutral">{t('modelsCount', { count: state.models.count })}</Tag>
              : null}
            <button
              type="button"
              className={css.reset}
              disabled={state.models.status === 'loading'}
              onClick={loadModels}
            >
              {t('modelsRefresh')}
            </button>
          </span>
        </div>
        <ModelsBody models={state.models} t={t} />
      </div>
      <div className={css.field}>
        <button
          type="button"
          className={css.disclosure}
          aria-expanded={limitsOpen}
          aria-controls="opencode-go-model-limits"
          onClick={() => { setLimitsOpen(!limitsOpen) }}
        >
          <IconChevronDownOutline14 aria-hidden="true" className={limitsOpen ? css.chevronOpen : css.chevron} />
          <span className={css.label}>{t('limitsLabel')}</span>
          {modelLimitsOverridden
            ? <Tag tone="neutral">{t('limitsSummary', { count: Object.keys(state.modelLimitDraft).length })}</Tag>
            : null}
        </button>
        <p className={css.hint}>{t('limitsHint')}</p>
        {limitsOpen
          ? (
            <div id="opencode-go-model-limits">
              <LimitsTable
                models={state.models}
                draft={state.modelLimitDraft}
                t={t}
                disabled={disabled}
                onEdit={(next) => { props.edit('modelLimits', JSON.stringify(next)) }}
              />
            </div>
          )
          : null}
      </div>
      <div className={css.field}>
        <button
          type="button"
          className={css.disclosure}
          aria-expanded={advanced}
          aria-controls="opencode-go-advanced"
          onClick={() => { setAdvanced(!advanced) }}
        >
          <IconChevronDownOutline14 aria-hidden="true" className={advanced ? css.chevronOpen : css.chevron} />
          <span className={css.label}>{t('advancedLabel')}</span>
          {advancedOverridden ? <Tag tone="neutral">{t('overridden')}</Tag> : null}
        </button>
        <p className={css.hint}>{t('advancedHint')}</p>
        {advanced
          ? (
            <div id="opencode-go-advanced" className={css.advanced}>
              <ValueField
                id="opencode-go-api-key-env"
                label={t('apiKeyEnvLabel')}
                hint={t('apiKeyEnvHint')}
                field={state.apiKeyEnv}
                {...fieldProps}
                onEdit={(text) => { props.edit('apiKeyEnv', text) }}
                onReset={() => { props.resetField('apiKeyEnv') }}
              />
              <ValueField
                id="opencode-go-base-url"
                label={t('baseURLLabel')}
                hint={t('baseURLHint')}
                field={state.baseURL}
                {...fieldProps}
                onEdit={(text) => { props.edit('baseURL', text) }}
                onReset={() => { props.resetField('baseURL') }}
              />
              <ValueField
                id="opencode-go-refresh-minutes"
                label={t('refreshMinutesLabel')}
                hint={t('refreshMinutesHint')}
                field={state.refreshMinutes}
                numeric
                {...fieldProps}
                onEdit={(text) => { props.edit('refreshMinutes', text) }}
                onReset={() => { props.resetField('refreshMinutes') }}
              />
              <ValueField
                id="opencode-go-stream-idle"
                label={t('streamIdleTimeoutMsLabel')}
                hint={t('streamIdleTimeoutMsHint')}
                field={state.streamIdleTimeoutMs}
                numeric
                {...fieldProps}
                onEdit={(text) => { props.edit('streamIdleTimeoutMs', text) }}
                onReset={() => { props.resetField('streamIdleTimeoutMs') }}
              />
              <ValueField
                id="opencode-go-max-request-image-bytes"
                label={t('maxRequestImageBytesLabel')}
                hint={t('maxRequestImageBytesHint')}
                field={state.maxRequestImageBytes}
                numeric
                {...fieldProps}
                onEdit={(text) => { props.edit('maxRequestImageBytes', text) }}
                onReset={() => { props.resetField('maxRequestImageBytes') }}
              />
              <ValueField
                id="opencode-go-image-pixel-budget"
                label={t('requestImagePixelBudgetLabel')}
                hint={t('requestImagePixelBudgetHint')}
                field={state.requestImagePixelBudget}
                numeric
                {...fieldProps}
                onEdit={(text) => { props.edit('requestImagePixelBudget', text) }}
                onReset={() => { props.resetField('requestImagePixelBudget') }}
              />
              <ValueField
                id="opencode-go-image-max-bytes"
                label={t('requestImageMaxBytesLabel')}
                hint={t('requestImageMaxBytesHint')}
                field={state.requestImageMaxBytes}
                numeric
                {...fieldProps}
                onEdit={(text) => { props.edit('requestImageMaxBytes', text) }}
                onReset={() => { props.resetField('requestImageMaxBytes') }}
              />
            </div>
          )
          : null}
      </div>
      <div className={css.actions}>
        <Button variant="primary" size="md" disabled={disabled || !state.dirty || state.invalid || state.saving} onClick={props.save}>
          {state.saving ? t('saving') : t('save')}
        </Button>
        <Button variant="outline" size="md" disabled={disabled || !state.dirty || state.saving} onClick={props.discard}>
          {t('discard')}
        </Button>
        {state.failed ? <p className={css.failedNote}>{t('savedFailed')}</p> : null}
      </div>
      {disabled ? <p className={css.hint}>{t('readOnly')}</p> : null}
    </div>
  )
}
