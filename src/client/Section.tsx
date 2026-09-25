/**
 * The OpenCode Go settings section. It leads with the one value a user has to
 * supply — the API key, stored write-only through the credentials domain — and
 * the models the gateway currently serves, then keeps the credential
 * reference, the endpoint, and the adapter tuning fields in the
 * `llm-opencode-go` namespace behind a collapsed disclosure.
 */

import { useEffect, useState } from 'react'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  OpencodeGoModels,
  OpencodeGoSectionFace,
  OpencodeGoSectionState,
} from './section-controller.ts'
import { ModelEditor } from './ModelEditor.tsx'
import type { en } from './locales.ts'
import css from './Section.module.css'

// 0.1.7 names icons by stroke weight; older hosts name them by pixel size.
const ChevronDown = (primitives as typeof primitives & {
  IconChevronDownOutlineRegular?: typeof primitives.IconChevronDownOutline14
}).IconChevronDownOutlineRegular ?? primitives.IconChevronDownOutline14

export type { OpencodeGoSectionState } from './section-controller.ts'

/** Section copy lookup, including the optional `{name}` template params. */
type SectionTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

/** Injected dependencies of {@link OpencodeGoSection} (slot `inject`). */
export interface OpencodeGoSectionInjected extends OpencodeGoSectionFace {
  /** Section copy. */
  t: SectionTranslate
  /** Read at render time because the Host caches injected values across locale changes. */
  getLocale?: () => string
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
function ModelsBody({ models, t, locale }: {
  models: OpencodeGoModels
  t: SectionTranslate
  locale?: string
}) {
  const sources = models.status === 'ready' || models.status === 'failed' ? models.sources : undefined
  const metadataOnlyFailure = sources?.metadata.error !== undefined && sources.listing.error === undefined
  const sourceStatus = sources
    ? (['listing', 'metadata'] as const).map(source => {
      const status = sources[source]
      return <p className={css.hint} key={source}>
        {t(source === 'listing' ? 'modelsListingSource' : 'modelsMetadataSource')}: {' '}
        {status.error ? t('modelsSourceFailed') : t('modelsSourceCurrent')}. {' '}
        {status.updatedAt === undefined ? t('modelsSourceNeverFetched')
          : t('modelsSourceUpdated', { time: new Date(status.updatedAt).toLocaleString(locale) })}
      </p>
    }) : null
  if (models.status === 'failed') {
    return (
      <>
        <p className={css.failedNote} role="alert">{t(metadataOnlyFailure ? 'modelsMetadataFailed' : 'modelsFailed')}</p>
        {models.message ? <p className={css.hint}>{models.message}</p> : null}
        {sourceStatus}
      </>
    )
  }
  if (models.status !== 'ready') return <p className={css.hint} role="status" aria-live="polite">{t('modelsLoading')}</p>
  const progress = models.refreshing ? <p className={css.hint} role="status">{t('modelsRefreshing')}</p> : null
  if (models.stale) return <>
    {progress}
    <p className={css.failedNote} role="alert">{t(metadataOnlyFailure ? 'modelsMetadataFailed' : 'modelsStale')}</p>
    {models.message ? <p className={css.hint}>{models.message}</p> : null}
    {sourceStatus}
  </>
  if (models.refreshing) return progress
  if (models.count === 0) return <p className={css.hint}>{t('modelsEmpty')}</p>
  return null
}

/**
 * Render the OpenCode Go settings page.
 * @param props - locale copy, the page snapshot, and its form actions.
 * @returns the section.
 */
export function OpencodeGoSection(props: OpencodeGoSectionProps) {
  const { useOpencodeGo, edit, resetField, save, discard, loadModels, setEnabled, setModelEnabled, t } = props
  if (useOpencodeGo === undefined || edit === undefined || resetField === undefined
    || save === undefined || discard === undefined || loadModels === undefined
    || setEnabled === undefined || setModelEnabled === undefined || t === undefined) return null
  return (
    <Loaded
      state={useOpencodeGo(snapshot => snapshot)}
      t={t}
      locale={props.getLocale?.()}
      edit={edit}
      resetField={resetField}
      save={save}
      discard={discard}
      loadModels={loadModels}
      setEnabled={setEnabled}
      setModelEnabled={setModelEnabled}
    />
  )
}

/** The page once every injected seat is present. */
function Loaded(props: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  locale?: string
  edit: (field: string, text: string) => void
  resetField: (field: string) => void
  save: () => void
  discard: () => void
  loadModels: () => void
  setEnabled: (next: boolean) => void
  setModelEnabled: (id: string, next: boolean) => void
}) {
  const { t, state, loadModels } = props
  const [advanced, setAdvanced] = useState(false)
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
  return (
    <div className={css.page}>
      <div className={css.pageBody}>
      <div className={css.pageTop}>
        <p className={css.intro}>{t('intro')}</p>
        <button
          type="button"
          className={css.advancedTrigger}
          aria-expanded={advanced}
          aria-controls="opencode-go-advanced"
          onClick={() => { setAdvanced(!advanced) }}
        >
          <ChevronDown className={advanced ? css.chevronOpen : css.chevron} />
          <span className={css.label}>{t('advancedLabel')}</span>
          {advancedOverridden ? <Tag tone="neutral">{t('overridden')}</Tag> : null}
        </button>
      </div>
      <div className={advanced ? css.field : undefined}>
        {advanced
          ? (
            <div id="opencode-go-advanced" className={css.advanced}>
              <p className={css.hint}>{t('advancedHint')}</p>
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
      <div className={css.field}>
        <div className={css.head}>
          <span className={css.label}>{t('enabledLabel')}</span>
          <Switch
            checked={state.enabled}
            label={t('enabledLabel')}
            // The settings document being read-only is what locks the switch;
            // the credential's own writability is unrelated to this field.
            disabled={disabled || state.saving || state.pickerSaving}
            onChange={props.setEnabled}
          />
        </div>
        <p className={css.hint}>{state.enabled ? t('enabledHint') : t('enabledOff')}</p>
      </div>
      <details className={css.keySection} open={!state.apiKeyConfigured || state.apiKey.text.length > 0}>
        <summary className={css.head}>
          <span className={css.label}>{t('keyLabel')}</span>
          <span className={css.badges}>
            <Tag tone={state.apiKeyConfigured ? 'success' : 'warning'}>
              {state.apiKeyConfigured ? t('keyConfigured') : t('keyMissing')}
            </Tag>
          </span>
        </summary>
        <input
          id="opencode-go-key"
          aria-label={t('keyLabel')}
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
      </details>
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
              disabled={state.models.status === 'loading' || state.models.status === 'ready' && state.models.refreshing}
              onClick={loadModels}
            >
              {t('modelsRefresh')}
            </button>
          </span>
        </div>
        <ModelsBody models={state.models} t={t} locale={props.locale} />
      </div>
      <div className={css.field}>
        {state.pickerFailed ? <p className={css.failedNote} role="alert">{t('pickerFailed')}</p> : null}
        <ModelEditor models={state.models} draft={state.modelLimitDraft} t={t} locale={props.locale} disabled={disabled || state.saving}
          modelVisibility={state.modelVisibility} visibilitySaving={state.pickerSaving}
          onModelEnabled={props.setModelEnabled}
          onEdit={next => { props.edit('modelLimits', JSON.stringify(next)) }} />
      </div>
      {disabled ? <p className={css.hint}>{t('readOnly')}</p> : null}
      </div>
      <div className={css.actions}>
        <Button variant="primary" size="md" disabled={disabled || !state.dirty || state.invalid || state.saving || state.pickerSaving} onClick={props.save}>
          {state.saving ? t('saving') : t('save')}
        </Button>
        <Button variant="outline" size="md" disabled={disabled || !state.dirty || state.saving} onClick={props.discard}>
          {t('discard')}
        </Button>
        <a className={css.starLink} href="https://github.com/Duskriver/dsh-opencode-go"
          target="_blank" rel="noopener noreferrer" title={t('starProjectTitle')}>
          {/* GitHub mark from Simple Icons (CC0). Inline so all supported Hosts share the same icon. */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          <span>{t('starProject')}</span>
        </a>
        {state.failed ? <p className={css.failedNote}>{t('savedFailed')}</p> : null}
      </div>
    </div>
  )
}
