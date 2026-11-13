/** Settings cards, account editors, model capacities and accessible field help. */
import css from './Section.module.css'
import usageCss from './UsagePill.module.css'
import {
  Tooltip,
  IconQuestionOutlineRegular,
  Button,
  Switch,
  Tag,
  IconChevronDownOutlineRegular as ChevronDown,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  type en,
  formatDateTime,
  GO_THEME_TOKENS,
  useGoThemeTokens,
  useHostScheme,
  themeStyle,
} from './presentation.ts'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  GoAccountsActions,
  GoAccountsState,
  GoAccountView,
  OpencodeGoModelLimit,
  OpencodeGoModelLimits,
  OpencodeGoModels,
  TextField,
  EditableField,
  OpencodeGoSectionFace,
  OpencodeGoSectionState,
} from './controller.ts'
import { modelsForSource, NUMERIC_FIELD_LIMITS } from './controller.ts'
import {
  MAX_ACCOUNTS,
  MAX_THINKING_BUDGET_TOKENS,
  modelSettingsKey,
  FREE_PROVIDER_ID,
  type ModelSource,
  INPUT_MODALITIES,
  isModelEnabled,
  isNewModel,
  sortModels,
  type GoModel,
  type InputModality,
  USAGE_DISPLAY_MODES,
  USAGE_PILL_STYLES,
  OPENCODE_GO_THEMES,
} from '../contracts.ts'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'

export function HintMark(props: { hint: string }) {
  return <Tooltip label={props.hint} side="bottom" maxWidth={280}>
    <button type="button" className={css.info} aria-label={props.hint}>
      <span aria-hidden="true"><IconQuestionOutlineRegular /></span>
    </button>
  </Tooltip>
}

export function HintText(props: { id: string; hint: string }) {
  return <p id={props.id} className={css.visuallyHidden}>{props.hint}</p>
}

type AccountTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

type Editor = { kind: 'add' | 'rename' | 'key' | 'remove'; ref?: string }

/** The three quota windows, in the order the panel reads them. */
const WINDOWS = ['rolling', 'weekly', 'monthly'] as const

/**
 * The rolling window's reset as a countdown: the row keeps the one number a reader
 * acts on, and the opened detail carries the absolute stamps.
 * @param resetsAt - ISO timestamp the gateway reported.
 * @param t - page translator.
 * @returns the countdown text.
 */
function resetText(resetsAt: string, t: AccountTranslate): string {
  const remaining = Date.parse(resetsAt) - Date.now()
  if (!Number.isFinite(remaining)) return t('usageResetUnknown')
  if (remaining <= 0) return t('usageResetDue')
  const minutes = Math.max(1, Math.round(remaining / 60_000))
  if (minutes < 60) return t('usageResetMinutes', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('usageResetHours', { hours })
  return t('usageResetDays', { days: Math.round(hours / 24) })
}

function shortResetText(resetsAt: string, t: AccountTranslate): string {
  const remaining = Date.parse(resetsAt) - Date.now()
  if (!Number.isFinite(remaining)) return t('usageResetCompactUnknown')
  if (remaining <= 0) return t('usageResetCompactDue')
  const minutes = Math.max(1, Math.round(remaining / 60_000))
  if (minutes < 60) return t('usageResetCompactMinutes', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('usageResetCompactHours', { hours })
  return t('usageResetCompactDays', { days: Math.round(hours / 24) })
}

function compactDateTime(value: string, locale: string | undefined, t: AccountTranslate): string {
  if (!Number.isFinite(Date.parse(value))) return t('usageResetUnknown')
  return formatDateTime(value, locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** The bar's reading, on the scale the composer pill already uses: amber from
 * 80%, red once the window is spent. */
function barLevel(window: { percent: number; status: string }): 'ok' | 'high' | 'limited' {
  if (window.status === 'rate-limited' || window.percent >= 100) return 'limited'
  return window.percent >= 80 ? 'high' : 'ok'
}

/** The card's one refresh stamp: the clock time while it is today, the date it
 * happened otherwise. */
function stampText(at: number, locale?: string): string {
  const date = new Date(at)
  const time = formatDateTime(date, locale, { hour: '2-digit', minute: '2-digit' })
  return date.toDateString() === new Date().toDateString() ? time : `${formatDateTime(date, locale, { year: 'numeric', month: 'numeric', day: 'numeric' })} ${time}`
}

/** The drag handle: six dots, the page's reorder affordance and the drag source. */
function GripIcon() {
  return <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
    <circle cx="2.5" cy="2.5" r="1.3" /><circle cx="7.5" cy="2.5" r="1.3" />
    <circle cx="2.5" cy="7" r="1.3" /><circle cx="7.5" cy="7" r="1.3" />
    <circle cx="2.5" cy="11.5" r="1.3" /><circle cx="7.5" cy="11.5" r="1.3" />
  </svg>
}

/**
 * The insertion slot the pointer names, read from the rows' own boxes: the slot
 * before the first row whose midline sits below the pointer, or the end of the
 * list. The boxes are stable for the whole gesture — the insertion mark is drawn
 * inside a row instead of as a grid item of its own, so showing it never reflows
 * the list the pointer is measured against.
 * @param container - the list element carrying the drop handlers.
 * @param clientY - pointer position, in viewport coordinates.
 * @returns the slot index between 0 and the row count.
 */
function slotAt(container: HTMLElement, clientY: number): number {
  const rows = container.querySelectorAll<HTMLElement>('[data-account-row]')
  for (let index = 0; index < rows.length; index++) {
    const box = rows[index]!.getBoundingClientRect()
    if (clientY < box.top + box.height / 2) return index
  }
  return rows.length
}

/**
 * The account card: a folded header that summarizes the set, and one row per
 * account inside. Rows keep the identity, key state, rolling quota and its reset
 * countdown; everything else opens under the row. The handle is the drag source —
 * dragging it, or the arrow keys on it, reorders the list, and the first row is
 * the preferred account. Every row is read in the same pass, so the one refresh
 * stamp belongs to the card and sits in its header.
 */
export function AccountsCard({ state, actions, writable, t, locale, addRequest = 0, defaultOpen = false, surface = 'settings' }: {
  state: GoAccountsState
  actions: GoAccountsActions
  writable: boolean
  t: AccountTranslate
  locale?: string
  /**
   * Rising counter from a page-level "Add account" action. The page owns the
   * button, the card owns the editor: asking through a counter keeps one add
   * form (and its draft state) instead of a second copy on the page.
   */
  addRequest?: number
  /** The console page shows the rows by default; the settings section keeps its fold. */
  defaultOpen?: boolean
  /** Settings keeps the hairline card; the console page draws a real card. */
  surface?: 'settings' | 'page'
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [details, setDetails] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const disabled = state.busy || state.blocked || !writable
  const total = state.entries.length
  const ready = state.entries.filter(entry => entry.configured === true).length
  const unreadable = state.entries.filter(entry => entry.failed === true).length
  const preferred = state.entries.find(entry => entry.apiKeyEnv === state.activeRef)
  const reorderable = !disabled && total > 1
  /** Row the drag started on, or -1 while nothing is being dragged. */
  const draggingFrom = dragging === null ? -1 : state.entries.findIndex(entry => entry.apiKeyEnv === dragging)
  /** A slot at the dragged row's own position changes nothing: no mark, and no write. */
  const noopSlot = draggingFrom >= 0 && (dropAt === draggingFrom || dropAt === draggingFrom + 1)
  /**
   * The edge of a row that carries the insertion mark for the current slot. The
   * mark lives inside the row it belongs to, so showing it never reflows the
   * list — a mark that pushed the rows down would move the pointer's own target
   * out from under it and the browser would cancel the drop entirely.
   * @param index - row being rendered.
   * @returns the edge to mark, or undefined for an unmarked row.
   */
  const markAt = (index: number): 'before' | 'after' | undefined => {
    if (!reorderable || dropAt === null || noopSlot) return undefined
    if (dropAt === index) return 'before'
    return dropAt === total && index === total - 1 ? 'after' : undefined
  }
  // One pass reads every row, so the card carries a single refresh stamp.
  const updatedAt = state.entries.reduce((latest, entry) => Math.max(latest, entry.updatedAt ?? 0), 0)
  useEffect(() => {
    actions.loadAccounts()
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') actions.loadAccounts() }, 60_000)
    return () => { clearInterval(timer) }
  }, [actions.loadAccounts])
  const start = (next: Editor, label = '') => {
    if (next.kind === 'add') actions.resetAddition?.()
    setEditor(next); setName(label); setKey('')
  }
  const cancel = () => {
    if (editor?.kind === 'add') actions.resetAddition?.()
    setEditor(null); setName(''); setKey('')
  }
  // A page-level toolbar can carry the add action while the editor below stays
  // the one in the card. Comparing against the previous request keeps a re-render
  // of the page from reopening a form the reader just cancelled.
  const requestedAdd = useRef(addRequest)
  useEffect(() => {
    if (addRequest === requestedAdd.current) return
    requestedAdd.current = addRequest
    setOpen(true)
    start({ kind: 'add' })
  }, [addRequest])
  // A row editor renders inside its row; when the row leaves the list — a
  // remove whose entry went but whose key cleanup did not — the editor would
  // strand itself with no visible Cancel and no Add button. Drop it instead.
  useEffect(() => {
    if (editor?.ref != null && !state.entries.some(entry => entry.apiKeyEnv === editor.ref)) cancel()
  }, [state.entries, editor])
  // The row a drag started on can leave the list under it — a remove from the
  // usage pill, a settings write from elsewhere. Its handle goes with it, so the
  // dragend that would clear the drag never reaches this card: clear it here.
  useEffect(() => {
    if (dragging !== null && !state.entries.some(entry => entry.apiKeyEnv === dragging)) {
      setDragging(null)
      setDropAt(null)
    }
  }, [state.entries, dragging])
  const submit = async () => {
    if (!editor) return
    const accepted = editor.kind === 'add' ? await actions.addAccount(name, key)
      : editor.kind === 'rename' ? await actions.renameAccount(editor.ref!, name)
        : editor.kind === 'key' ? await actions.replaceAccountKey(editor.ref!, key)
          : await actions.removeAccount(editor.ref!)
    if (accepted) cancel()
  }
  const move = (ref: string, toIndex: number): void => { void actions.moveAccount(ref, toIndex) }
  const summary = total
    ? t('accountsSummary', { count: total, name: preferred ? (preferred.name || t('accountDefault')) : '' })
    : t('accountsSummaryEmpty')
  const editorTitle = (kind: Editor['kind']): string => t(kind === 'add' ? 'accountAdd' : kind === 'rename' ? 'accountRename'
    : kind === 'key' ? 'accountReplaceKey' : 'accountRemove')
  /** The editor renders inside the row it edits; adding one renders under the list. */
  const editorForm = (label = '') => editor ? <form className={css.accountEditor}
    onSubmit={event => { event.preventDefault(); void submit() }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancel() } }}>
    <div className={css.accountEditorHead}>
      <span className={css.accountEditorTitle}>{editorTitle(editor.kind)}</span>
      {label ? <span className={css.accountEditorFor}>{label}</span> : null}
    </div>
    {editor.kind === 'remove' ? <p className={css.hint}>{t('accountRemoveHint', { name })}</p> : null}
    {editor.kind === 'add' || editor.kind === 'rename' ? <label className={css.accountField}>{t('accountName')}
      <input className={css.input} value={name} maxLength={80} required disabled={state.busy} autoFocus
        onChange={event => { setName(event.target.value) }} />
    </label> : null}
    {editor.kind === 'add' || editor.kind === 'key' ? <><label className={css.accountField}>{t('keyLabel')}
      <input className={css.input} type="password" autoComplete="off" value={key} required disabled={state.busy} autoFocus
        onChange={event => { setKey(event.target.value) }} />
    </label><p className={css.hint}>{t('accountKeyHint')}</p></> : null}
    <div className={css.accountEditorActions}>
      <Button variant="primary" size="sm" type="submit"
        disabled={editor.kind === 'key' ? state.busy || state.blocked : disabled}>{t(state.busy ? 'saving' : 'accountConfirm')}</Button>
      <Button variant="outline" size="sm" type="button" disabled={state.busy} onClick={cancel}>{t('accountCancel')}</Button>
    </div>
  </form> : null
  const detail = (account: GoAccountView, label: string, index: number, isActive: boolean, panelId: string) =>
    <div id={panelId} className={css.accountDetail} data-account-detail="">
      <div className={css.accountManageStrip} data-account-manage="">
        <span className={css.accountManageMeta}>
          {t(isActive ? 'accountManagePrimary' : 'accountManageBackup', { rank: index + 1 })}
        </span>
        <div className={css.accountActions}>
          <Button variant="outline" size="sm" disabled={disabled}
            onClick={() => { start({ kind: 'rename', ref: account.apiKeyEnv }, label) }}>{t('accountRename')}</Button>
          <Button variant="outline" size="sm" disabled={state.busy || state.blocked || account.writable === false}
            onClick={() => { start({ kind: 'key', ref: account.apiKeyEnv }, label) }}>{t('accountReplaceKey')}</Button>
          <Button className={css.accountRemoveBtn} variant="outline" size="sm" disabled={disabled}
            onClick={() => { start({ kind: 'remove', ref: account.apiKeyEnv }, label) }}>{t('accountRemove')}</Button>
        </div>
      </div>
      {account.usage ? <div className={css.accountUsage} data-account-quotas="">
        {WINDOWS.map(window => <div key={window} className={css.accountBentoTile}>
          <div className={css.accountBentoTop}>
            <span className={css.accountBentoLabel}>{t(`usage_${window}`)}</span>
            <strong className={css.accountBentoPct}>{account.usage![window].percent}%</strong>
          </div>
          <progress data-level={barLevel(account.usage![window])} max={100}
            value={Math.min(100, account.usage![window].percent)}
            aria-label={`${label} ${t(`usage_${window}`)}`} />
          <span className={css.accountBentoReset} title={`${t('usageResets')} ${formatDateTime(account.usage![window].resetsAt, locale)}`}>
            {t('usageResets')} {compactDateTime(account.usage![window].resetsAt, locale, t)}
          </span>
        </div>)}
      </div> : <p className={css.hint}>{t(account.loading ? 'usageLoading' : 'usageUnavailable')}</p>}
    </div>
  const cardClass = surface === 'page' ? css.cardPage + ' ' + css.accountsCard : open ? css.card : css.card + ' ' + css.cardFolded
  const foldTone = total === 0 ? 'neutral' : unreadable > 0 || ready < total ? 'warning' : 'success'
  return <section className={cardClass}>
    <div className={css.cardHead + ' ' + css.accountsHead}>
      <button type="button" className={css.cardTrigger} aria-expanded={open} aria-controls="opencode-go-accounts"
        onClick={() => { setOpen(!open) }}>
        <span className={css.cardTriggerRow}>
          <span className={css.cardTitle}>{t('accountsTitle')}</span>
          <span className={css.foldBadge} data-tone={foldTone}>
            {total > 0 ? <span className={css.foldDot} aria-hidden="true" /> : null}
            {total > 0 ? <span className={css.foldText}>
              {t(unreadable > 0 ? 'accountsAvailabilityFailed' : 'accountsAvailability', { ready, total, failed: unreadable })}
            </span> : null}
            <ChevronDown className={open ? css.chevronOpen : css.chevron} />
          </span>
        </span>
        <span className={css.cardSub}>{summary}</span>
      </button>
      <span className={css.trailing}>
        {updatedAt > 0 ? <span className={css.cardStamp} title={formatDateTime(updatedAt, locale)}>
          {t('usageLastUpdated')} {stampText(updatedAt, locale)}
        </span> : null}
        <Button variant="outline" size="sm" disabled={state.refreshing}
          onClick={actions.loadAccounts}>{t(state.refreshing ? 'usageRefreshing' : 'accountsRefresh')}</Button>
      </span>
    </div>
    {open ? <div id="opencode-go-accounts" className={css.cardBody}>
      {state.blocked ? <p className={css.hint}>{t('accountsBlocked')}</p> : null}
      {state.failure ? <p className={css.failedNote} role="alert">{t(state.failure === 'cleanup' ? 'accountsCleanupFailed'
        : state.failure === 'remove' ? 'accountsRemoveKeyFailed'
        : state.failure === 'read' ? 'accountsReadFailed' : 'accountsWriteFailed')}</p> : null}
      {!total ? <p className={css.hint}>{t('accountsEmpty')}</p> : null}
      {/* The list is the drop surface, not an individual row: the slots between
          rows, the insertion mark and the pointer's own row all belong to it, so
          a release never lands on an element with no handler — which the browser
          answers by dispatching no drop at all. */}
      <div className={css.accounts}
        onDragEnter={event => {
          // Accept the entry, not only the hover: a drag whose last event is an
          // uncancelled dragenter — the pointer stopped moving while a child
          // mounted under it — is one the browser answers with no drop at all.
          if (reorderable && dragging !== null) event.preventDefault()
        }}
        onDragOver={event => {
          if (!reorderable || dragging === null) return
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
          setDropAt(slotAt(event.currentTarget, event.clientY))
        }}
        onDrop={event => {
          const source = dragging
          setDragging(null)
          setDropAt(null)
          if (source === null) return
          event.preventDefault()
          const from = state.entries.findIndex(entry => entry.apiKeyEnv === source)
          if (from < 0) return
          // Where the release landed decides, not the last hover: a drop can
          // arrive at a point the drag never reported, and the browser does not
          // promise a hover for every pixel the pointer crossed.
          const slot = Number.isFinite(event.clientY) ? slotAt(event.currentTarget, event.clientY) : dropAt
          if (slot === null) return
          const to = slot > from ? slot - 1 : slot
          // A drop that lands where the row already sits changes nothing; it is
          // not a refused write, so it neither writes nor reports a failure.
          if (to !== from) move(source, to)
        }}
        onDragEnd={() => { setDragging(null); setDropAt(null) }}>
        {state.entries.map((account, index) => {
          const label = account.name || t('accountDefault')
          const rolling = account.usage?.rolling
          const expanded = details === account.apiKeyEnv
          const panelId = `opencode-go-account-${index}`
          const isActive = state.activeRef ? account.apiKeyEnv === state.activeRef : index === 0
          return <Fragment key={account.id}>
            <div className={css.accountRow} data-account-row={account.apiKeyEnv}
              data-active={isActive ? 'true' : undefined}
              data-open={expanded ? 'true' : undefined}
              data-dragging={dragging === account.apiKeyEnv ? 'true' : undefined}
              data-drop={markAt(index)}
              onDragStart={event => {
                // Only the handle is a drag source; a stray text drag stays a text drag.
                if (!reorderable || (event.target as HTMLElement | null)?.closest?.('[data-account-handle]') == null) {
                  event.preventDefault()
                  return
                }
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', account.apiKeyEnv)
                  // The row, not the small handle, is what the reader sees following the pointer.
                  if (typeof event.dataTransfer.setDragImage === 'function') {
                    event.dataTransfer.setDragImage(event.currentTarget, 16, 16)
                  }
                }
                setDragging(account.apiKeyEnv)
              }}>
              <div className={css.accountMain} data-account-main="">
                <div className={css.accountLead}>
                  <button type="button" className={css.accountHandle} data-account-handle="" draggable={reorderable}
                    disabled={!reorderable} title={t('accountDragHandle', { name: label })}
                    aria-label={t('accountDragHandle', { name: label })}
                    onKeyDown={event => {
                      if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); move(account.apiKeyEnv, index - 1) }
                      if (event.key === 'ArrowDown' && index < total - 1) { event.preventDefault(); move(account.apiKeyEnv, index + 1) }
                    }}>
                    <GripIcon />
                  </button>
                  <div className={css.accountIdentity}>
                    <span className={css.accountRank} data-primary={isActive ? 'true' : undefined}>
                      {t(isActive ? 'accountRankCurrent' : 'accountRankBackup', { rank: index + 1 })}
                    </span>
                    <strong className={css.accountName} title={label}>{label}</strong>
                    <span className={css.accountState}>
                      <span className={css.accountDot} data-off={account.configured === false ? 'true' : undefined} />
                      {account.configured === undefined ? t(account.failed ? 'accountsStatusUnknown' : 'usageLoading') : account.configured ? t('keyConfigured') : t('keyMissing')}
                    </span>
                  </div>
                </div>
                <div className={css.accountTail}>
                  {!expanded ? (rolling ? <span className={css.accountCompactStat} title={resetText(rolling.resetsAt, t)}>
                    {t('usageRollingCompact')} <strong>{rolling.percent}%</strong> · {shortResetText(rolling.resetsAt, t)}
                  </span> : <span className={css.accountIdle}>{account.configured === false
                    ? t('accountConfigureHint') : t(account.loading ? 'usageLoading' : 'usageUnavailable')}</span>) : null}
                  <button type="button" className={css.accountToggle} aria-expanded={expanded} aria-controls={panelId}
                    aria-label={t(expanded ? 'accountsDetailsHide' : 'accountsDetails', { name: label })}
                    onClick={() => { setDetails(expanded ? null : account.apiKeyEnv) }}>
                    <ChevronDown className={expanded ? css.chevronOpen : css.chevron} />
                  </button>
                </div>
              </div>
              {!expanded && rolling ? <span className={css.accountBar} role="progressbar" data-level={barLevel(rolling)}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, rolling.percent)}
                aria-label={`${label} ${t('usage_rolling')}`}>
                <span className={css.accountBarFill} style={{ width: `${Math.min(100, rolling.percent)}%` }} />
              </span> : null}
              {account.failed ? <div className={css.accountProblems} role="alert">
                <p className={css.failedNote}>{account.problem ?? t(account.stale ? 'usageStaleHint' : 'usageRefreshFailed')}</p>
                <button type="button" className={css.accountRetry} disabled={state.refreshing}
                  onClick={actions.loadAccounts}>{t('usageRetry')}</button>
              </div> : null}
              {expanded ? detail(account, label, index, isActive, panelId) : null}
              {editor?.ref === account.apiKeyEnv ? editorForm(label) : null}
            </div>
          </Fragment>
        })}
      </div>
      {editor ? (editor.kind === 'add' ? editorForm() : null) : null}
      <div className={css.accountsFoot}>
        {editor ? null : <Button className={css.addAccount} variant="outline" size="sm" disabled={disabled || total >= MAX_ACCOUNTS}
          onClick={() => { start({ kind: 'add' }) }}>{t('accountAdd')}</Button>}
        <div className={css.field}>
          <div className={css.head}><span className={css.label}>{t('accountAutoSwitch')}<HintMark hint={t('accountAutoSwitchHint')} /></span>
            <Switch checked={state.autoSwitch} disabled={disabled} label={t('accountAutoSwitch')}
              // The Switch primitive carries no aria-describedby; title is the one
              // channel it forwards, and the mark opens the same sentence in a bubble.
              title={t('accountAutoSwitchHint')}
              onChange={next => { void actions.setAutoSwitch(next) }} /></div>
        </div>
      </div>
    </div> : null}
  </section>
}

type ModelTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

/** Chip copy for each token the gateway can declare. */
const MODALITY_COPY = {
  text: 'modalityText', image: 'modalityImage', audio: 'modalityAudio',
  video: 'modalityVideo', pdf: 'modalityPdf',
} as const satisfies Record<InputModality, keyof typeof en>

export function hasCapacityOverride(limit: OpencodeGoModelLimit | null | undefined): boolean {
  return limit?.contextWindow != null || limit?.maxTokens != null || (limit?.thinkingBudgets?.length ?? 0) > 0
}

/** Every control here applies immediately; the editor only stages what the
 *  reader is still typing (Capacity commits a settled value). */
export function ModelEditor({ source = 'go', models, draft, modelVisibility, t, locale, disabled, visibilitySaving, onEdit, onModelEnabled }: {
  source?: ModelSource
  models: OpencodeGoModels
  draft: OpencodeGoModelLimits
  modelVisibility: Readonly<Record<string, boolean>>
  t: ModelTranslate
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
    const update = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      setNow(Date.now())
    }
    const timer = setInterval(update, 3_600_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  // Saved overrides never establish membership: only a successful gateway listing does.
  const modelEntries = models.status === 'ready' ? models.entries : undefined
  const all = useMemo(() => sortModels(modelEntries ?? [], now), [modelEntries, now])
  const normalized = query.trim().toLocaleLowerCase()
  const customized = useMemo(() => all.filter(entry => hasCapacityOverride(draft[modelSettingsKey(entry)])).length, [all, draft])
  const ownKeys = Object.keys(draft).filter(key => key.startsWith(`${FREE_PROVIDER_ID}/`) === (source === 'free'))
  const filters = useMemo(() => [
    ['all', 'filterAll', all.length],
    ['new', 'filterNew', all.filter(entry => isNewModel(entry, now)).length],
    ['custom', 'filterCustom', customized],
    ['deprecated', 'filterDeprecated', all.filter(entry => entry.deprecated).length],
  ] as const, [all, now, customized])
  const entries = useMemo(() => all.filter(model => `${model.name ?? ''} ${model.id}`.toLocaleLowerCase().includes(normalized)
    && (filter === 'all' || filter === 'new' && isNewModel(model, now)
      || filter === 'custom' && hasCapacityOverride(draft[modelSettingsKey(model)]) || filter === 'deprecated' && model.deprecated)), [all, normalized, filter, now, draft])
  const model = entries.find(entry => entry.id === selected) ?? entries[0]
  const visibilityDisabled = disabled || visibilitySaving
  const write = (id: string, field: keyof OpencodeGoModelLimit, value: number | number[] | undefined): void => {
    const current = draft[id] === null ? { contextWindow: null, maxTokens: null, thinkingBudgets: null } : draft[id] ?? {}
    onEdit({ ...draft, [id]: { ...current, [field]: value ?? null } })
  }
  const badges = (entry: GoModel) => <>
    {entry.configurationMissing ? <Tag tone="warning">{t('configurationMissing')}</Tag> : null}
    {isNewModel(entry, now) ? <span className={css.newBadge} title={t('newHint')}>{t('newBadge')}</span> : null}
    {entry.deprecated ? <Tag tone="warning">{t('deprecatedBadge')}</Tag> : null}
  </>
  return (
    <div className={css.limitsEditor}>
      <div className={css.modelSearchRow}>
        <label className={css.visuallyHidden} htmlFor="opencode-go-model-filter">{t('limitsFilterLabel')}</label>
        <input id="opencode-go-model-filter" className={css.input} type="search" autoComplete="off"
          placeholder={t('limitsFilterPlaceholder')} value={query} onChange={event => { setQuery(event.target.value) }} />
        <div className={css.filters} role="group" aria-label={t('filterLabel')}>
          {filters.map(([key, label, count]) => <button key={key} type="button" className={css.filter}
            aria-pressed={filter === key} onClick={() => { setFilter(key) }}>{t(label)} <span>{count}</span></button>)}
        </div>
      </div>
      <p className={css.modelHelp}>{t('visibilityHint')}</p>
      {model ? (
        <div className={css.modelLayout}>
          {/* A group, not a <nav>: the model picker is not navigation, and any
              `nav button` styled by the host or a theme plugin would restyle
              every row control (issue #76). */}
          <div className={css.modelList} role="group" aria-label={t('modelsLabel')}>
            {entries.map(entry => <div key={entry.id}
              className={entry.id === model.id ? `${css.modelRow} ${css.modelRowSelected}` : css.modelRow}>
              <button type="button" className={css.modelChoice}
                aria-pressed={entry.id === model.id} onClick={() => { setSelected(entry.id) }}>
                {/* The row carries the name and its badges only; the model id and
                    the release date belong to the parameter card. */}
                <span className={css.modelName}>{entry.name ?? entry.id} {badges(entry)}
                  {hasCapacityOverride(draft[modelSettingsKey(entry)])
                    ? <span className={css.overrideDot} title={t('overridden')} aria-hidden="true" />
                    : null}
                </span>
              </button>
              <Switch label={t('modelVisibleLabel', { name: entry.name ?? entry.id })}
                checked={isModelEnabled(entry, modelVisibility)} disabled={visibilityDisabled || entry.configurationMissing}
                onChange={enabled => { onModelEnabled(modelSettingsKey(entry), enabled) }} />
            </div>)}
          </div>
          <section className={css.modelDetails} aria-label={t('modelDetails')}>
            <div className={css.modelHeading}>
              <h3>{model.name ?? model.id}</h3>
              {badges(model)}
            </div>
            {/* The id and its release date share one line; the full provenance of
                the date stays in its title. */}
            <div className={css.modelMeta}>
              <code className={css.limitsModelId} translate="no">{model.id}</code>
              {model.releaseDate
                ? <span className={css.releaseDate} title={t('releaseSource', { date: model.releaseDate })}>{model.releaseDate}</span>
                : null}
            </div>
            {model.configurationMissing ? <p className={css.hint}>{t('configurationMissingHint')}</p> : <>
              {model.deprecated ? <p className={css.hint}>{t('deprecatedHint')}</p> : null}
              <div className={css.stats}>
                <Capacity model={model} field="contextWindow" limit={draft[modelSettingsKey(model)]} t={t} locale={locale} disabled={disabled} onChange={write} />
                <Capacity model={model} field="maxTokens" limit={draft[modelSettingsKey(model)]} t={t} locale={locale} disabled={disabled} onChange={write} />
                <div className={css.stat}>
                  <span className={css.statLabel}>{t('modalityLabel')}</span>
                  <Modalities model={model} t={t} />
                </div>
              </div>
              {model.reasoningBudget ? <BudgetPresets key={model.id} model={model} limit={draft[modelSettingsKey(model)]}
                t={t} locale={locale} disabled={disabled} onChange={values => { write(modelSettingsKey(model), 'thinkingBudgets', values) }} /> : null}
              {hasCapacityOverride(draft[modelSettingsKey(model)]) ? <button type="button" className={css.reset} disabled={disabled}
                onClick={() => { onEdit({ ...draft, [modelSettingsKey(model)]: null }) }}>{t('limitsResetModel')}</button> : null}
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
      {/* The tally is not a footnote to the list: it closes the card on a line
          of its own, with the one action that clears the overrides beside it. */}
      <div className={css.limitsFoot}>
        <span className={css.limitsSummary}>{t('limitsSummary', { count: customized })}</span>
        {ownKeys.some(key => hasCapacityOverride(draft[key])) ? <Button variant="outline" size="sm" disabled={disabled}
          onClick={() => { onEdit({ ...draft, ...Object.fromEntries(ownKeys.map(id => [id, null])) }) }}>{t('limitsResetAll')}</Button> : null}
      </div>
    </div>
  )
}

/**
 * Declared input modalities as chips, in catalog order. An undeclared modality
 * stays visible but dashed: the model simply does not accept that input.
 */
function Modalities({ model, t }: { model: GoModel; t: ModelTranslate }) {
  const declared = model.inputModalities
  if (declared === undefined || declared.length === 0) return <span className={css.hint}>{t('modalityUnknown')}</span>
  return <span className={css.modalities}>
    {INPUT_MODALITIES.map(modality => <span key={modality}
      className={declared.includes(modality) ? css.modality : css.modalityOff}>
      {t(MODALITY_COPY[modality])}
    </span>)}
  </span>
}

/** How long typing must pause before a capacity field commits itself. */
const CAPACITY_COMMIT_DELAY_MS = 700

/**
 * One numeric capacity, written as soon as the value settles: on blur, on Enter,
 * or after a short pause in typing. The input keeps its own text so a write
 * round-trip never rewrites the digits under the reader, and text the schema
 * refuses stays in the field, marked invalid, without being committed.
 */
function Capacity({ model, field, limit, disabled, t, locale, onChange }: {
  model: GoModel
  field: 'contextWindow' | 'maxTokens'
  limit: OpencodeGoModelLimit | null | undefined
  disabled: boolean
  t: ModelTranslate
  locale?: string
  onChange: (id: string, field: 'contextWindow' | 'maxTokens', value: number | undefined) => void
}) {
  const id = `opencode-go-${field}-${encodeURIComponent(model.id)}`
  const catalogValue = model[field]
  const defaultValue = field === 'maxTokens' && catalogValue !== undefined ? Math.min(catalogValue, 65_536) : catalogValue
  const cappedOutput = field === 'maxTokens' && catalogValue !== undefined && catalogValue > 65_536
  const saved = limit?.[field]
  const savedText = saved == null ? '' : String(saved)
  const [text, setText] = useState(savedText)
  const [editing, setEditing] = useState(false)
  // Adopt the saved value (or the newly shown model's value) unless the reader
  // is mid-edit: a stale buffer on a focused field would eat their next keystroke.
  const syncKey = `${model.id}:${field}:${savedText}`
  const synced = useRef(syncKey)
  useEffect(() => {
    if (editing || synced.current === syncKey) return
    synced.current = syncKey
    setText(savedText)
  }, [editing, syncKey, savedText])
  const invalid = text.trim() !== '' && !(Number.isSafeInteger(Number(text)) && Number(text) > 0)
  /** Write what the field holds, if it is writable; never throws the text away. */
  const commit = (): void => {
    setEditing(false)
    const raw = text.trim()
    if (raw === '') {
      // Empty means "inherit the catalog value": it only writes when an override
      // is saved, so clearing an already empty field changes nothing.
      if (saved != null) onChange(modelSettingsKey(model), field, undefined)
      return
    }
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value <= 0) return
    if (value === saved) { setText(String(value)); return }
    onChange(modelSettingsKey(model), field, value)
  }
  // A pause in typing is a commit too: nothing else on this card blurs the field
  // for the reader, and the value must land without a Save gesture.
  useEffect(() => {
    if (!editing) return
    const timer = setTimeout(commit, CAPACITY_COMMIT_DELAY_MS)
    return () => { clearTimeout(timer) }
  }, [editing, text])
  return <div className={css.stat}>
    <label className={css.statLabel} htmlFor={id}>{t(field === 'contextWindow' ? 'limitsContext' : 'limitsOutput')}</label>
    <input id={id} className={css.input} type="number" min={1} max={field === 'maxTokens' ? model.maxTokens : undefined} step={1} inputMode="numeric"
      aria-label={t(field === 'contextWindow' ? 'limitsContextLabel' : 'limitsOutputLabel', { name: model.name ?? model.id })}
      aria-describedby={`${id}-default`} value={text}
      placeholder={defaultValue === undefined ? t('capacityMissing') : String(defaultValue)} disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={event => { setEditing(true); setText(event.target.value) }}
      onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} />
    <span id={`${id}-default`} className={css.hint}>
      {cappedOutput
        ? t('capacityDefaultCapped', { value: defaultValue!.toLocaleString(locale), max: catalogValue.toLocaleString(locale) })
        : t('capacityDefault', { value: defaultValue === undefined ? t('capacityMissing') : defaultValue.toLocaleString(locale) })}
      {limit?.[field] != null ? ` · ${t('overridden')}` : ''}
    </span>
  </div>
}

function BudgetPresets({ model, limit, disabled, t, locale, onChange }: {
  model: GoModel
  limit: OpencodeGoModelLimit | null | undefined
  disabled: boolean
  t: ModelTranslate
  locale?: string
  onChange: (values: number[] | undefined) => void
}) {
  const [text, setText] = useState('')
  const range = model.reasoningBudget!
  // Output room and the Host schema both cap a budget; the input and the Add
  // button use the effective floor of the three so neither can stage a value the
  // Host will refuse.
  const max = Math.min(range.max, MAX_THINKING_BUDGET_TOKENS, (limit?.maxTokens ?? model.maxTokens ?? range.max + 1024) - 1024)
  const values = limit?.thinkingBudgets ?? []
  const tokens = Number(text)
  const valid = text.trim() !== '' && Number.isSafeInteger(tokens) && tokens >= range.min && tokens <= max
  const id = `opencode-go-thinking-budget-${encodeURIComponent(model.id)}`
  return <details className={css.budgetEditor}>
    <summary>{t('thinkingBudgets')}</summary>
    <p className={css.hint}>{t('thinkingBudgetsHint', { min: range.min.toLocaleString(locale), max: max.toLocaleString(locale) })}</p>
    <label className={css.statLabel} htmlFor={id}>{t('thinkingBudgetAddLabel', { name: model.name ?? model.id })}</label>
    <div className={css.budgetInput}>
      <input id={id} className={css.input} type="number" step={1} min={range.min} max={max} inputMode="numeric"
        value={text} placeholder="4096" disabled={disabled} aria-invalid={text !== '' && !valid}
        onChange={event => { setText(event.target.value) }} />
      <Button variant="outline" size="sm" disabled={disabled || !valid || values.includes(tokens) || values.length >= 16}
        onClick={() => { onChange([...values, tokens].sort((a, b) => a - b)); setText('') }}>{t('thinkingBudgetAdd')}</Button>
    </div>
    {values.length > 0 ? <div className={css.budgetPresets}>
      {values.map(value => <button key={value} type="button" className={css.filter} disabled={disabled}
        aria-label={t('thinkingBudgetRemove', { value })}
        onClick={() => { const next = values.filter(tokens => tokens !== value); onChange(next.length > 0 ? next : undefined) }}>
        {value.toLocaleString(locale)} tokens ×
      </button>)}
    </div> : null}
  </details>
}

/** The tuning fields covered by the advanced parameter reset, in display order. */
const ADVANCED_FIELDS = [
  'baseURL', 'freeBaseURL', 'proxyURL',
  'refreshMinutes', 'streamIdleTimeoutMs', 'requestPreparationTimeoutMs', 'requestTimeoutMs',
  'maxImages', 'maxRequestImageBytes', 'requestImagePixelBudget', 'requestImageMaxBytes',
] as const

/**
 * Mirror the Host schema bounds onto one numeric input. The parse side enforces the
 * same table, so what the browser offers and what Save accepts cannot disagree.
 * @param field - the numeric settings field.
 * @returns the ValueField props for its number input.
 */
function numericBounds(field: TextField): { numeric: true; min?: number; max?: number; step: number | 'any' } {
  const limit = NUMERIC_FIELD_LIMITS[field]
  return {
    numeric: true,
    ...(limit !== undefined && limit.min !== undefined ? { min: limit.min } : {}),
    ...(limit?.max === undefined ? {} : { max: limit.max }),
    step: limit !== undefined && !limit.integer ? 'any' : 1,
  }
}

const APPEARANCE_FIELDS = ['appearanceTheme', 'showSidebarQuota', 'usagePillStyle'] as const
/** The appearance tab also owns the quota display mode, so one reset covers that card. */
const APPEARANCE_TAB_FIELDS = [...APPEARANCE_FIELDS, 'usageDisplay'] as const

/** The page's top-level tabs, in reading order. */
const SETTINGS_TABS = ['overview', 'models', 'appearance', 'advanced'] as const
type SettingsTab = typeof SETTINGS_TABS[number]

export type { OpencodeGoSectionState } from './controller.ts'

/** Section copy lookup, including the optional `{name}` template params. */
type SectionTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

/** Injected dependencies of {@link OpencodeGoSection} (slot `inject`). */
export interface OpencodeGoSectionInjected extends OpencodeGoSectionFace {
  /** Section copy. */
  t: SectionTranslate
  /** Read at render time because the Host caches injected values across locale changes. */
  getLocale?: () => string
  /**
   * Opens the full sidebar page from the settings section. Optional: hosts that
   * never register the page simply leave the secondary button out.
   */
  openPage?: () => void
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type OpencodeGoSectionProps = Partial<InjectFace<OpencodeGoSectionInjected>>

interface ValueFieldProps {
  id: string
  label: string
  hint: string
  field: OpencodeGoSectionState['baseURL']
  invalidLabel: string
  disabled: boolean
  numeric?: boolean
  /** Browser-side bounds mirrored from the Host schema; only used for number inputs. */
  min?: number
  max?: number
  step?: number | 'any'
  placeholder?: string
  options?: readonly { value: string; label: string }[]
  onEdit: (text: string) => void
}

/**
 * One staged value field: its label with the hint mark, the override badge with
 * reset, and one control. A small enum renders as a segmented control — every
 * option is visible at once — and everything else as a text or number input.
 */
function ValueField(props: ValueFieldProps) {
  const hintId = props.id + '-hint'
  const errorId = props.id + '-error'
  const labelId = props.id + '-label'
  const options = props.options
  const selected = options ? options.findIndex(option => option.value === props.field.text) : -1
  // The control describes itself with its hint, and with its error while the draft
  // is invalid: the alert announces the failure once, and this keeps the specific
  // sentence available on every later focus.
  const describedBy = props.field.invalid ? `${errorId} ${hintId}` : hintId
  return (
    <div className={css.row}>
      <div className={css.rowLabel}>
        {options
          ? <span id={labelId} className={css.rowTitle}>{props.label}</span>
          : <label htmlFor={props.id} className={css.rowTitle}>{props.label}</label>}
        <HintMark hint={props.hint} />
      </div>
      <div className={css.rowControl}>
        {options ? (
          <div
            className={css.seg}
            role="radiogroup"
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            data-count={options.length}
            data-index={selected < 0 ? 0 : selected}
            {...props.field.invalid ? { 'aria-invalid': true } : {}}
            onKeyDown={event => {
              const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
                : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
              if (step === 0) return
              event.preventDefault()
              const next = (Math.max(0, selected) + step + options.length) % options.length
              props.onEdit(options[next].value)
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
            }}
          >
            <span className={css.segThumb} aria-hidden="true" />
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === props.field.text}
                tabIndex={option.value === props.field.text ? 0 : -1}
                className={css.segOption}
                disabled={props.disabled}
                onClick={() => { props.onEdit(option.value) }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : <input
          id={props.id}
          name={props.id}
          autoComplete="off"
          placeholder={props.placeholder}
          aria-describedby={describedBy}
          className={props.field.invalid ? css.inputInvalid : css.input}
          type={props.numeric === true ? 'number' : 'text'}
          {...props.numeric === true ? { inputMode: 'numeric' as const } : {}}
          {...props.numeric === true && props.min !== undefined ? { min: props.min } : {}}
          {...props.numeric === true && props.max !== undefined ? { max: props.max } : {}}
          {...props.numeric === true && props.step !== undefined ? { step: props.step } : {}}
          {...props.field.invalid ? { 'aria-invalid': true } : {}}
          value={props.field.text}
          disabled={props.disabled}
          onChange={(event) => { props.onEdit(event.target.value) }}
        />}
      </div>
      <HintText id={hintId} hint={props.hint} />
      {props.field.invalid ? <p id={errorId} className={css.rowInvalid} role="alert">{props.invalidLabel}</p> : null}
    </div>
  )
}

/** Appearance controls; the card above them owns the heading and reset. */
function QuotaAppearance({ state, t, disabled, onEdit }: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  disabled: boolean
  onEdit: (field: TextField, text: string) => void
}) {
  const scheme = useHostScheme()
  const draftTheme = state.appearanceTheme.text === 'classic' ? 'classic' : 'native'
  const tokens = GO_THEME_TOKENS[draftTheme][scheme]
  const locked = disabled || state.saving
  const themeId = 'opencode-go-appearance-theme'
  const themeDescribedBy = state.appearanceTheme.invalid ? `${themeId}-hint ${themeId}-error` : `${themeId}-hint`
  const styleId = 'opencode-go-usage-pill-style'
  const describedBy = state.usagePillStyle.invalid ? `${styleId}-hint ${styleId}-error` : `${styleId}-hint`
  return <div className={css.appearanceGroup}>
    <div className={css.rows}>
    <fieldset className={css.appearanceStyles} role="radiogroup" aria-labelledby={`${themeId}-label`}
      aria-describedby={themeDescribedBy} aria-invalid={state.appearanceTheme.invalid || undefined}>
      <legend className={css.appearanceLegend}>
        <span id={`${themeId}-label`} className={css.rowTitle}>{t('appearanceThemeLabel')}</span>
        <HintMark hint={t('appearanceThemeHint')} />
      </legend>
      <p id={`${themeId}-hint`} className={css.appearanceHint}>{t('appearanceThemePreviewHint')}</p>
      <div className={css.appearanceChoices}>
        {OPENCODE_GO_THEMES.map(value => <label key={value} className={css.appearanceChoice}
          data-selected={state.appearanceTheme.text === value} data-disabled={locked}>
          <span className={css.appearanceChoiceHead}>
            <span>{t(`appearanceTheme_${value}`)}</span>
            <input type="radio" name={themeId} value={value} className={css.appearanceRadio}
              checked={state.appearanceTheme.text === value} disabled={locked} aria-describedby={themeDescribedBy}
              onChange={() => { onEdit('appearanceTheme', value) }} />
          </span>
          <span className={css.appearancePreview} style={themeStyle(GO_THEME_TOKENS[value][scheme])} aria-hidden="true">
            <span className={`${usageCss.trigger} ${css.appearanceSample}`}>
              {t('usageRollingShort')} 24% · {t('usageWeekShort')} 48%
            </span>
          </span>
        </label>)}
      </div>
      {state.appearanceTheme.invalid
        ? <p id={`${themeId}-error`} className={css.rowInvalid} role="alert">{t('invalidValue')}</p> : null}
    </fieldset>
    <div className={css.appearanceToggle}>
      <div className={css.appearanceCopy}>
        <div className={css.rowLabel}>
          <span className={css.rowTitle}>{t('showSidebarQuotaLabel')}</span>
          <HintMark hint={t('showSidebarQuotaHint')} />
        </div>
        <p className={css.appearanceHint}>{t('showSidebarQuotaSummary')}</p>
      </div>
      <Switch checked={state.showSidebarQuota.text === 'true'} label={t('showSidebarQuotaLabel')}
        title={t('showSidebarQuotaHint')} disabled={locked}
        onChange={next => { onEdit('showSidebarQuota', String(next)) }} />
    </div>
    <fieldset className={css.appearanceStyles} role="radiogroup" aria-labelledby={`${styleId}-label`}
      aria-describedby={describedBy} aria-invalid={state.usagePillStyle.invalid || undefined}>
      <legend className={css.appearanceLegend}>
        <span id={`${styleId}-label`} className={css.rowTitle}>{t('usagePillStyleLabel')}</span>
        <HintMark hint={t('usagePillStyleHint')} />
      </legend>
      <p id={`${styleId}-hint`} className={css.appearanceHint}>{t('usagePillStylePreviewHint')}</p>
      <div className={css.appearanceChoices}>
        {USAGE_PILL_STYLES.map(value => <label key={value} className={css.appearanceChoice}
          data-selected={state.usagePillStyle.text === value} data-disabled={locked}>
          <span className={css.appearanceChoiceHead}>
            <span>{t(`usagePillStyle_${value}`)}</span>
            <input type="radio" name={styleId} value={value} className={css.appearanceRadio}
              checked={state.usagePillStyle.text === value} disabled={locked} aria-describedby={describedBy}
              onChange={() => { onEdit('usagePillStyle', value) }} />
          </span>
          <span className={css.appearancePreview} style={themeStyle(tokens)} aria-hidden="true">
            <span className={`${usageCss.trigger} ${value === 'plain' ? usageCss.plain : ''} ${css.appearanceSample}`}>
              {t('usageRollingShort')} 24% · {t('usageWeekShort')} 48%
            </span>
          </span>
        </label>)}
      </div>
      {state.usagePillStyle.invalid
        ? <p id={`${styleId}-error`} className={css.rowInvalid} role="alert">{t('invalidValue')}</p> : null}
    </fieldset>
    </div>
  </div>
}

/** Compact freshness for the selected source; full timestamps stay available on hover. */
function ModelSourceStatus({ models, source, t, locale }: {
  models: OpencodeGoModels
  source: ModelSource
  t: SectionTranslate
  locale?: string
}) {
  const status = models.status === 'ready' || models.status === 'failed' ? models.sources?.[source] : undefined
  const busy = models.status === 'idle' || models.status === 'loading' || models.status === 'ready' && models.refreshing
  const failed = models.status === 'failed' || models.status === 'ready' && models.stale
  const label = busy ? t('modelsRefreshingShort') : failed ? t('modelsSourceFailed')
    : status?.updatedAt === undefined && status !== undefined ? t('modelsSourceNeverFetched') : t('modelsSourceCurrent')
  const updated = status?.updatedAt === undefined ? undefined : new Date(status.updatedAt)
  const fullTime = updated ? t('modelsSourceUpdated', { time: formatDateTime(updated, locale) }) : undefined
  const detail = `${t(source === 'go' ? 'modelsGoSource' : 'modelsFreeSource')}: ${label}${fullTime ? `. ${fullTime}` : ''}`
  const sameDay = updated?.toDateString() === new Date().toDateString()
  const progressLabel = models.status === 'ready' ? t('modelsRefreshing') : t('modelsLoading')
  return <span className={css.modelSync} role="status" aria-label={busy ? progressLabel : detail}
    data-state={busy ? 'loading' : failed ? 'failed' : updated ? 'ready' : 'idle'} title={detail}>
    <span className={css.modelSyncDot} aria-hidden="true" />
    <span>{label}</span>
    {updated && !busy ? <time dateTime={updated.toISOString()}>{formatDateTime(updated, locale, {
      ...(sameDay ? {} : { month: 'short', day: 'numeric' }), hour: '2-digit', minute: '2-digit', hour12: false,
    })}</time> : null}
  </span>
}

/** Keep only actionable failures and warnings below the catalog toolbar. */
function ModelsBody({ models, t, source, showProgress = true }: {
  models: OpencodeGoModels
  source?: ModelSource
  t: SectionTranslate
  showProgress?: boolean
}) {
  const sources = models.status === 'ready' || models.status === 'failed' ? models.sources : undefined
  if (models.status === 'failed') {
    return (
      <>
        <p className={css.failedNote} role="alert">{t('modelsFailed')}</p>
        {models.message ? <p className={css.hint}>{models.message}</p> : null}
      </>
    )
  }
  if (models.status !== 'ready') return showProgress ? <p className={css.hint} role="status" aria-live="polite">{t('modelsLoading')}</p> : null
  const progress = showProgress && models.refreshing ? <p className={css.hint} role="status">{t('modelsRefreshing')}</p> : null
  if (models.stale) return <>
    {progress}
    <p className={css.failedNote} role="alert">{t('modelsStale')}</p>
    {models.message ? <p className={css.hint}>{models.message}</p> : null}
  </>
  const warnings = (source ? [source] : ['go', 'free'] as const).map(key => sources?.[key]?.warning)
    .filter((warning): warning is string => Boolean(warning))
  return <>{progress}{warnings.map((warning, index) => <p className={css.failedNote} role="alert" key={index}>{warning}</p>)}
    {models.count === 0 ? <p className={css.hint}>{t('modelsEmpty')}</p> : null}</>
}

/**
 * The Appearance tab's card. Extracted from `Loaded` so the sidebar page and the
 * settings section render one implementation; the classes and children are the
 * ones the settings tests already read.
 */
export function AppearanceSettings({ state, t, disabled, saving, onEdit, resetField, surface = 'settings' }: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  disabled: boolean
  saving: boolean
  onEdit: (field: TextField, text: string) => void
  resetField: (field: EditableField) => void
  surface?: 'settings' | 'page'
}) {
  // Invalid drafts cannot be saved, but must still be recoverable with Reset.
  const canReset = APPEARANCE_TAB_FIELDS.some(field => state[field].overridden || state[field].invalid)
  // Appearance writes as each control changes; a refused write names this card.
  const writeFailed = state.writeFailed !== undefined
    && (APPEARANCE_TAB_FIELDS as readonly string[]).includes(state.writeFailed)
  return <section className={surface === 'page' ? css.cardPage : css.card}>
    <div className={css.cardBody}>
      <div className={css.rows}>
        <ValueField
          id="opencode-go-usage-display"
          label={t('usageDisplayLabel')}
          hint={t('usageDisplayHint')}
          field={state.usageDisplay}
          options={USAGE_DISPLAY_MODES.map(value => ({ value, label: t(`usageDisplay_${value}`) }))}
          invalidLabel={t('invalidValue')}
          disabled={disabled}
          onEdit={text => { onEdit('usageDisplay', text) }}
        />
        <QuotaAppearance state={state} t={t} disabled={disabled} onEdit={onEdit} />
      </div>
      {writeFailed ? <p className={css.failedNote} role="alert">{t('immediateWriteFailed')}</p> : null}
      {/* The reset action closes the card: a title row above the fields only
          repeated the tab label and pushed the first setting down. */}
      <div className={css.cardActions}>
        <button type="button" className={css.reset}
          disabled={disabled || saving || !canReset}
          onClick={() => {
            for (const field of APPEARANCE_TAB_FIELDS) {
              if (state[field].overridden || state[field].invalid) resetField(field)
            }
          }}>
          {t('usageAppearanceReset')}
        </button>
      </div>
    </div>
  </section>
}

/**
 * The Advanced tab's card: connection overrides, cache/timeout tuning and the
 * image budget, closed by the reset-all row. Extracted from `Loaded` unchanged
 * so the full page can carry the same fields.
 */
export function AdvancedSettings({ state, t, disabled, saving, invalidLabel, edit, resetField, surface = 'settings' }: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  disabled: boolean
  saving: boolean
  invalidLabel: string
  edit: (field: TextField, text: string) => void
  resetField: (field: EditableField) => void
  surface?: 'settings' | 'page'
}) {
  const advancedOverridden = ADVANCED_FIELDS.some(field => state[field].overridden)
  // Invalid drafts cannot be saved, but must still be recoverable with Reset.
  const canReset = ADVANCED_FIELDS.some(field => state[field].overridden || state[field].invalid)
  return <section className={surface === 'page' ? css.cardPage : css.card}>
    <div className={css.cardBody}>
      {/* The one card with a Save gesture says so up front: every other surface
          applies on change, so a reader must not look for Save on them. */}
      <p className={css.hint}>{t('advancedSaveHint')}</p>
      <div className={css.rows}>
        <div className={css.groupHead}>{t('groupConnection')}</div>
        <ValueField
          id="opencode-go-base-url"
          label={t('baseURLLabel')}
          hint={t('baseURLHint')}
          field={state.baseURL}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('baseURL', text) }}
        />
        <ValueField
          id="opencode-go-free-base-url"
          label={t('freeBaseURLLabel')}
          hint={t('freeBaseURLHint')}
          field={state.freeBaseURL}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={text => { edit('freeBaseURL', text) }}
        />
        <ValueField
          id="opencode-go-proxy-url"
          label={t('proxyURLLabel')}
          hint={t('proxyURLHint')}
          placeholder="http://127.0.0.1:7890"
          field={state.proxyURL}
          invalidLabel={t('proxyURLInvalid')}
          disabled={disabled}
          onEdit={(text) => { edit('proxyURL', text) }}
        />
        <div className={css.groupHead}>{t('groupCacheTimeouts')}</div>
        <ValueField
          id="opencode-go-refresh-minutes"
          label={t('refreshMinutesLabel')}
          hint={t('refreshMinutesHint')}
          field={state.refreshMinutes}
          {...numericBounds('refreshMinutes')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('refreshMinutes', text) }}
        />
        <ValueField
          id="opencode-go-stream-idle"
          label={t('streamIdleTimeoutMsLabel')}
          hint={t('streamIdleTimeoutMsHint')}
          field={state.streamIdleTimeoutMs}
          {...numericBounds('streamIdleTimeoutMs')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('streamIdleTimeoutMs', text) }}
        />
        <ValueField
          id="opencode-go-request-preparation-timeout"
          label={t('requestPreparationTimeoutMsLabel')}
          hint={t('requestPreparationTimeoutMsHint')}
          field={state.requestPreparationTimeoutMs}
          {...numericBounds('requestPreparationTimeoutMs')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('requestPreparationTimeoutMs', text) }}
        />
        <ValueField
          id="opencode-go-request-timeout"
          label={t('requestTimeoutMsLabel')}
          hint={t('requestTimeoutMsHint')}
          field={state.requestTimeoutMs}
          {...numericBounds('requestTimeoutMs')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('requestTimeoutMs', text) }}
        />
        <div className={css.groupHead}>{t('groupImages')}</div>
        <ValueField
          id="opencode-go-max-images"
          label={t('maxImagesLabel')}
          hint={t('maxImagesHint')}
          field={state.maxImages}
          {...numericBounds('maxImages')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('maxImages', text) }}
        />
        <ValueField
          id="opencode-go-max-request-image-bytes"
          label={t('maxRequestImageBytesLabel')}
          hint={t('maxRequestImageBytesHint')}
          field={state.maxRequestImageBytes}
          {...numericBounds('maxRequestImageBytes')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('maxRequestImageBytes', text) }}
        />
        <ValueField
          id="opencode-go-image-pixel-budget"
          label={t('requestImagePixelBudgetLabel')}
          hint={t('requestImagePixelBudgetHint')}
          field={state.requestImagePixelBudget}
          {...numericBounds('requestImagePixelBudget')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('requestImagePixelBudget', text) }}
        />
        <ValueField
          id="opencode-go-image-max-bytes"
          label={t('requestImageMaxBytesLabel')}
          hint={t('requestImageMaxBytesHint')}
          field={state.requestImageMaxBytes}
          {...numericBounds('requestImageMaxBytes')}
          invalidLabel={invalidLabel}
          disabled={disabled}
          onEdit={(text) => { edit('requestImageMaxBytes', text) }}
        />
      </div>
      {/* The reset action closes the card, so the tab strip is followed by the
          first setting instead of a title row that repeated the tab label. */}
      <div className={css.cardActions}>
        {advancedOverridden ? <Tag tone="neutral">{t('overridden')}</Tag> : null}
        <button type="button" className={css.reset}
          disabled={disabled || saving || !canReset}
          onClick={() => {
            for (const field of ADVANCED_FIELDS) {
              if (state[field].overridden || state[field].invalid) resetField(field)
            }
          }}>
          {t('advancedResetAll')}
        </button>
      </div>
    </div>
  </section>
}

/**
 * The Models tab's card: the Go/Free source tabs, the listing status and the
 * capacity editor. The selected source is local (as it was in `Loaded`), so the
 * page and the section behave the same on remount.
 */
export function ModelsSettings({ state, t, locale, disabled, onEdit, setModelEnabled, loadModels, surface = 'settings' }: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  locale?: string
  disabled: boolean
  onEdit: (value: OpencodeGoModelLimits) => void
  setModelEnabled: (id: string, next: boolean) => void
  loadModels: () => void
  surface?: 'settings' | 'page'
}) {
  const [modelSource, setModelSource] = useState<ModelSource>('go')
  const goModels = useMemo(() => modelsForSource(state.models, 'go'), [state.models])
  const freeModels = useMemo(() => modelsForSource(state.models, 'free'), [state.models])
  const models = modelSource === 'go' ? goModels : freeModels
  // The model tab carries the listing's own diagnostics and a refused switch write.
  const modelNotices = (
    <>
      <ModelsBody models={models} source={modelSource} t={t} />
      {state.pickerFailed ? <p className={css.failedNote} role="alert">{t('pickerFailed')}</p> : null}
    </>
  )
  return <section className={surface === 'page' ? css.cardModelsPage : css.cardModels}>
    <div id="opencode-go-models" className={css.cardBody}>
      <div className={css.modelToolbar}>
        <div className={css.modelTabs} role="tablist" aria-label={t('modelSourcesLabel')}>
          {(['go', 'free'] as const).map(source => {
            const catalog = source === 'go' ? goModels : freeModels
            const status = catalog.status === 'ready' || catalog.status === 'failed' ? catalog.sources?.[source] : undefined
            const label = t(source === 'go' ? 'modelsGoTab' : 'modelsFreeTab')
            return <button key={source} type="button" role="tab" aria-label={label}
              title={status?.error ?? status?.warning}
              id={`opencode-model-tab-${source}`} aria-selected={modelSource === source}
              tabIndex={modelSource === source ? 0 : -1}
              aria-controls="opencode-model-panel" className={css.modelTab}
              onKeyDown={event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next = event.key === 'Home' ? 'go' : event.key === 'End' ? 'free' : source === 'go' ? 'free' : 'go'
                setModelSource(next)
                document.getElementById(`opencode-model-tab-${next}`)?.focus()
              }}
              onClick={() => { setModelSource(source) }}>{label}
              {catalog.status === 'ready' ? <span className={css.modelTabCount} aria-hidden="true">{catalog.count}</span> : null}
              {status?.error || status?.warning ? <span className={css.modelTabWarning} aria-hidden="true" /> : null}
            </button>
          })}
        </div>
        <div className={css.modelTools}>
          <ModelSourceStatus models={models} source={modelSource} t={t} locale={locale} />
          <Button variant="outline" size="sm"
            disabled={state.models.status === 'loading' || state.models.status === 'ready' && state.models.refreshing}
            onClick={loadModels}>{t('modelsRefresh')}</Button>
        </div>
      </div>
      <div role="tabpanel" id="opencode-model-panel" className={css.modelPanel} aria-labelledby={`opencode-model-tab-${modelSource}`}>
        {state.writeFailed === 'modelLimits'
          ? <p className={css.failedNote} role="alert">{t('immediateWriteFailed')}</p> : null}
        {modelNotices}
        {/* Capacity edits write immediately, so an in-flight write must not
            disable the field being typed in: only the document's writability
            locks the editor. Visibility switches keep the pending-write lock. */}
        <ModelEditor key={modelSource} source={modelSource} models={models} draft={state.modelLimitDraft} t={t} locale={locale} disabled={disabled}
          modelVisibility={state.modelVisibility} visibilitySaving={state.pickerSaving}
          onModelEnabled={setModelEnabled}
          onEdit={onEdit} />
      </div>
    </div>
  </section>
}

/**
 * Render the OpenCode Go settings page.
 * @param props - locale copy, the page snapshot, and its form actions.
 * @returns the section.
 */
export function OpencodeGoSection(props: OpencodeGoSectionProps) {
  const { useOpencodeGo, edit, resetField, save, discard, loadModels, setEnabled, setSidebarEntry, setModelEnabled, t } = props
  if (useOpencodeGo === undefined || edit === undefined || resetField === undefined
    || save === undefined || discard === undefined || loadModels === undefined
    || setEnabled === undefined || setSidebarEntry === undefined || setModelEnabled === undefined
    || props.editModelLimits === undefined || t === undefined
    || !props.loadAccounts || !props.addAccount || !props.renameAccount || !props.removeAccount
    || !props.selectAccount || !props.setAutoSwitch || !props.replaceAccountKey || !props.moveAccount) return null
  return (
    <Loaded
      state={useOpencodeGo(snapshot => snapshot)}
      t={t}
      locale={props.getLocale?.()}
      edit={edit}
      editModelLimits={props.editModelLimits}
      resetField={resetField}
      save={save}
      discard={discard}
      loadModels={loadModels}
      setEnabled={setEnabled}
      setSidebarEntry={setSidebarEntry}
      setModelEnabled={setModelEnabled}
      openPage={props.openPage}
      accountActions={{
        loadAccounts: props.loadAccounts, addAccount: props.addAccount, renameAccount: props.renameAccount,
        resetAddition: props.resetAddition, removeAccount: props.removeAccount, selectAccount: props.selectAccount,
        setAutoSwitch: props.setAutoSwitch, replaceAccountKey: props.replaceAccountKey, moveAccount: props.moveAccount,
      }}
    />
  )
}

/** The page once every injected seat is present. */
function Loaded(props: {
  state: OpencodeGoSectionState
  t: SectionTranslate
  locale?: string
  edit: (field: TextField, text: string) => void
  editModelLimits: (value: OpencodeGoModelLimits) => void
  resetField: (field: EditableField) => void
  save: () => void
  discard: () => void
  loadModels: () => void
  setEnabled: (next: boolean) => void
  /** Opt the sidebar row and its console page in or out; applied immediately. */
  setSidebarEntry: (next: boolean) => void
  setModelEnabled: (id: string, next: boolean) => void
  /** Opens the full sidebar page; absent on hosts that have not registered it. */
  openPage?: () => void
  accountActions: GoAccountsActions
}) {
  const { t, state, loadModels } = props
  const tokens = useGoThemeTokens(state.appliedAppearanceTheme)
  // Tabs keep one class of settings on screen at a time: the overview is the
  // landing state, and the other tabs carry the former cards' contents.
  const [tab, setTab] = useState<SettingsTab>('overview')
  // The shell mounts only the open section, so a mount is the page being
  // opened: read the listing once, and let the button re-read it afterwards.
  useEffect(() => {
    if (state.status === 'ready' && state.models.status === 'idle') loadModels()
  }, [state.status, state.models.status, loadModels])
  // Loading and unavailable are different states: before the Host has answered,
  // the page must not claim the deployment does not serve these settings.
  if (state.status === 'loading') {
    return <div className={css.page} style={themeStyle(tokens)}><p className={css.intro} role="status">{t('settingsLoading')}</p></div>
  }
  if (state.status === 'unavailable') {
    return <div className={css.page} style={themeStyle(tokens)}><p className={css.intro}>{t('unavailable')}</p></div>
  }
  const disabled = !state.writable
  // The provider switch says what its state means; the mark opens the sentence.
  const enabledHint = state.enabled ? t('enabledHint') : t('enabledOff')
  const accountCard = <AccountsCard
    state={state.accounts} actions={props.accountActions} writable={state.writable}
    t={t} locale={props.locale} />
  // Only Advanced keeps a draft: appearance writes as soon as it changes, so
  // its tab must not claim pending edits (the models mark reports its listing).
  const advancedOverridden = ADVANCED_FIELDS.some(field => state[field].overridden)
  const tabs: { id: SettingsTab; label: string; marked?: boolean }[] = [
    { id: 'overview', label: t('settingsTabOverview') },
    { id: 'models', label: t('settingsTabModels'), marked: state.pickerFailed || state.models.status === 'failed' || state.models.status === 'ready' && state.models.stale },
    { id: 'appearance', label: t('settingsTabAppearance') },
    { id: 'advanced', label: t('settingsTabAdvanced'), marked: advancedOverridden },
  ]
  return (
    <div className={css.page} style={themeStyle(tokens)}>
      <div className={css.pageBody}>
      <div className={css.pageTop}>
        {/* The sidebar row is the primary way into the page; the settings section
            keeps a secondary way there once the host wires `openPage`. The
            plain title stays when it is absent, so hosts without the page (and
            the existing tests) render exactly the old DOM. */}
        {props.openPage
          ? <div className={css.head}>
            <h2 className={css.title}>{t('titleLabel')}</h2>
            <Button variant="outline" size="sm" onClick={props.openPage}>{t('openFullPage')}</Button>
          </div>
          : <h2 className={css.title}>{t('titleLabel')}</h2>}
      </div>
      <div className={css.pageTabs} role="tablist" aria-label={t('settingsTabsLabel')}>
        {tabs.map((item, index) => <button key={item.id} type="button" role="tab" id={`opencode-go-tab-${item.id}`}
          aria-selected={tab === item.id} aria-controls={`opencode-go-panel-${item.id}`}
          data-marked={item.marked ? '' : undefined}
          tabIndex={tab === item.id ? 0 : -1} className={css.pageTab}
          onClick={() => { setTab(item.id) }}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? SETTINGS_TABS[0]
              : event.key === 'End' ? SETTINGS_TABS[SETTINGS_TABS.length - 1]
              : SETTINGS_TABS[(index + (event.key === 'ArrowRight' ? 1 : SETTINGS_TABS.length - 1)) % SETTINGS_TABS.length]
            setTab(next)
            document.getElementById(`opencode-go-tab-${next}`)?.focus()
          }}>
          {item.label}
          {item.marked ? <span className={css.tabMark} title={t('overridden')} aria-hidden="true" /> : null}
        </button>)}
      </div>
      {tab === 'overview' ? <div className={css.tabPanel} role="tabpanel" id="opencode-go-panel-overview" aria-labelledby="opencode-go-tab-overview">
      <div className={css.overviewRows}>
      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('enabledLabel')}<HintMark hint={enabledHint} /></h3>
          <Switch
            checked={state.enabled}
            label={t('enabledLabel')}
            // The Switch primitive carries no aria-describedby, so its description
            // rides the only channel it forwards; the mark opens the same sentence
            // in the Host's bubble for a pointer.
            title={enabledHint}
            // The settings document being read-only is what locks the switch;
            // the credential's own writability is unrelated to this field.
            disabled={disabled || state.saving || state.pickerSaving}
            onChange={props.setEnabled}
          />
        </div>
        {state.enabledFailed ? <p className={css.failedNote} role="alert">{t('enabledFailed')}</p> : null}
      </section>
      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('freeEnabledLabel')}<HintMark hint={t('freeEnabledHint')} /></h3>
          <Switch
            checked={state.freeEnabled.text === 'true'}
            label={t('freeEnabledLabel')}
            title={t('freeEnabledHint')}
            disabled={disabled || state.saving}
            onChange={next => { props.edit('freeEnabled', String(next)) }}
          />
        </div>
        {state.writeFailed === 'freeEnabled'
          ? <p className={css.failedNote} role="alert">{t('immediateWriteFailed')}</p> : null}
      </section>
      {/* The opt-in row lives here because the console page it opens does not
          exist while the switch is off: this card is the only way back in. */}
      <section className={css.card}>
        <div className={css.cardHead}>
          <h3 className={css.cardTitle}>{t('sidebarEntryLabel')}<HintMark hint={t('sidebarEntryHint')} /></h3>
          <Switch
            checked={state.sidebarEntry}
            label={t('sidebarEntryLabel')}
            // The Switch primitive forwards only title as its description; the
            // mark opens the same sentence in a bubble.
            title={t('sidebarEntryHint')}
            disabled={disabled || state.saving || state.pickerSaving}
            onChange={props.setSidebarEntry}
          />
        </div>
        <div className={css.cardBody}>
          <p className={css.hint}>{t('sidebarEntrySummary')}</p>
          {state.sidebarEntryFailed
            ? <p className={css.failedNote} role="alert">{t('sidebarEntryFailed')}</p> : null}
        </div>
      </section>
      {accountCard}
      </div>
      </div> : null}
      {tab === 'models' ? <div className={css.tabPanel} role="tabpanel" id="opencode-go-panel-models" aria-labelledby="opencode-go-tab-models">
      <ModelsSettings state={state} t={t} locale={props.locale} disabled={disabled}
        onEdit={props.editModelLimits} setModelEnabled={props.setModelEnabled} loadModels={loadModels} />
      </div> : null}
      {tab === 'appearance' ? <div className={css.tabPanel} role="tabpanel" id="opencode-go-panel-appearance" aria-labelledby="opencode-go-tab-appearance">
      <AppearanceSettings state={state} t={t} disabled={disabled} saving={state.saving}
        onEdit={props.edit} resetField={props.resetField} />
      </div> : null}
      {tab === 'advanced' ? <div className={css.tabPanel} role="tabpanel" id="opencode-go-panel-advanced" aria-labelledby="opencode-go-tab-advanced">
      <AdvancedSettings state={state} t={t} disabled={disabled} saving={state.saving} invalidLabel={t('invalidValue')}
        edit={props.edit} resetField={props.resetField} />
      </div> : null}
      {disabled ? <p className={css.hint}>{t('readOnly')}</p> : null}
      </div>
      <div className={css.actions}>
        {/* Only the Advanced card keeps a draft, so Save and Discard appear
            there and nowhere else: every other tab writes as it changes. The
            star link is not a form action and stays visible everywhere. */}
        {tab === 'advanced' ? <>
          <Button variant="primary" size="md" disabled={disabled || !state.dirty || state.invalid || state.saving || state.pickerSaving} onClick={props.save}>
            {state.saving ? t('saving') : t('save')}
          </Button>
          <Button variant="outline" size="md" disabled={disabled || !state.dirty || state.saving} onClick={props.discard}>
            {t('discard')}
          </Button>
        </> : null}
        <a className={css.starLink} href="https://github.com/Duskriver/dsh-opencode-go"
          target="_blank" rel="noopener noreferrer" title={t('starProjectTitle')}>
          {/* GitHub mark from Simple Icons (CC0). Inline so all supported Hosts share the same icon. */}
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
          </svg>
          <span>{t('starProject')}</span>
        </a>
        {tab === 'advanced' && state.failed ? <p className={css.failedNote}>{t('savedFailed')}</p> : null}
      </div>
    </div>
  )
}
