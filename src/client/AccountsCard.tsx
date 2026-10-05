import { Fragment, useEffect, useState } from 'react'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GoAccountsActions, GoAccountsState, GoAccountView } from './accounts-controller.ts'
import { MAX_ACCOUNTS } from '../accounts.ts'
import type { en } from './locales.ts'
import css from './Section.module.css'

type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string
type Editor = { kind: 'add' | 'rename' | 'key' | 'remove'; ref?: string }
/** The three quota windows, in the order the panel reads them. */
const WINDOWS = ['rolling', 'weekly', 'monthly'] as const
/** Where the wide bar carries its quarter marks. */
const TICKS = [25, 50, 75] as const

/** The disclosure chevron the page's other cards use, across host versions. */
const ChevronDown = (primitives as typeof primitives & {
  IconChevronDownOutlineRegular?: typeof primitives.IconChevronDownOutline14
}).IconChevronDownOutlineRegular ?? primitives.IconChevronDownOutline14

/**
 * The rolling window's reset as a countdown: the row keeps the one number a reader
 * acts on, and the opened detail carries the absolute stamps.
 * @param resetsAt - ISO timestamp the gateway reported.
 * @param t - page translator.
 * @returns the countdown text.
 */
function resetText(resetsAt: string, t: Translate): string {
  const remaining = Date.parse(resetsAt) - Date.now()
  if (!Number.isFinite(remaining)) return t('usageResetUnknown')
  if (remaining <= 0) return t('usageResetDue')
  const minutes = Math.max(1, Math.round(remaining / 60_000))
  if (minutes < 60) return t('usageResetMinutes', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('usageResetHours', { hours })
  return t('usageResetDays', { days: Math.round(hours / 24) })
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
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return date.toDateString() === new Date().toDateString() ? time : `${date.toLocaleDateString(locale)} ${time}`
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
 * The account card: a folded header that summarizes the set, and one row per
 * account inside. Rows keep the identity, key state, rolling quota and its reset
 * countdown; everything else opens under the row. The handle is the drag source —
 * dragging it, or the arrow keys on it, reorders the list, and the first row is
 * the preferred account. Every row is read in the same pass, so the one refresh
 * stamp belongs to the card and sits in its header.
 */
export function AccountsCard({ state, actions, writable, t, locale }: {
  state: GoAccountsState
  actions: GoAccountsActions
  writable: boolean
  t: Translate
  locale?: string
}) {
  const [open, setOpen] = useState(false)
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
  // One pass reads every row, so the card carries a single refresh stamp.
  const updatedAt = state.entries.reduce((latest, entry) => Math.max(latest, entry.updatedAt ?? 0), 0)
  useEffect(() => {
    actions.loadAccounts()
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') actions.loadAccounts() }, 60_000)
    return () => { clearInterval(timer) }
  }, [actions.loadAccounts])
  const start = (next: Editor, label = '') => { setEditor(next); setName(label); setKey('') }
  const cancel = () => { setEditor(null); setName(''); setKey('') }
  // A row editor renders inside its row; when the row leaves the list — a
  // remove whose entry went but whose key cleanup did not — the editor would
  // strand itself with no visible Cancel and no Add button. Drop it instead.
  useEffect(() => {
    if (editor?.ref != null && !state.entries.some(entry => entry.apiKeyEnv === editor.ref)) cancel()
  }, [state.entries, editor])
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
  const detail = (account: GoAccountView, label: string) => <div className={css.accountDetail}>
    {account.usage ? <div className={css.accountUsage}>
      {WINDOWS.map(window => <div key={window}>
        <span>{t(`usage_${window}`)} · {account.usage![window].percent}%</span>
        <progress data-level={barLevel(account.usage![window])} max={100}
          value={Math.min(100, account.usage![window].percent)}
          aria-label={`${label} ${t(`usage_${window}`)}`} />
        <span className={css.hint}>{t('usageResets')} {new Date(account.usage![window].resetsAt).toLocaleString(locale)}</span>
      </div>)}
    </div> : <p className={css.hint}>{t(account.loading ? 'usageLoading' : 'usageUnavailable')}</p>}
    <div className={css.accountActions}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => { start({ kind: 'rename', ref: account.apiKeyEnv }, label) }}>{t('accountRename')}</Button>
      <Button variant="outline" size="sm" disabled={state.busy || state.blocked || account.writable === false} onClick={() => { start({ kind: 'key', ref: account.apiKeyEnv }, label) }}>{t('accountReplaceKey')}</Button>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => { start({ kind: 'remove', ref: account.apiKeyEnv }, label) }}>{t('accountRemove')}</Button>
    </div>
  </div>
  return <section className={open ? css.card : css.card + ' ' + css.cardFolded}>
    <div className={css.cardHead}>
      <button type="button" className={css.cardTrigger} aria-expanded={open} aria-controls="opencode-go-accounts"
        onClick={() => { setOpen(!open) }}>
        <span className={css.cardTitle}>{t('accountsTitle')}</span>
        <span className={css.cardSub}>{summary}</span>
        {total > 0 ? <Tag tone={unreadable > 0 || ready < total ? 'warning' : 'success'}>
          {t(unreadable > 0 ? 'accountsAvailabilityFailed' : 'accountsAvailability', { ready, total, failed: unreadable })}
        </Tag> : null}
        <ChevronDown className={open ? css.chevronOpen : css.chevron} />
      </button>
      <span className={css.trailing}>
        {updatedAt > 0 ? <span className={css.cardStamp} title={new Date(updatedAt).toLocaleString(locale)}>
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
      <div className={css.accounts}>
        {state.entries.map((account, index) => {
          const label = account.name || t('accountDefault')
          const rolling = account.usage?.rolling
          const expanded = details === account.apiKeyEnv
          const panelId = `opencode-go-account-${index}`
          return <Fragment key={account.id}>
            {reorderable && dropAt === index ? <div className={css.accountDropLine} /> : null}
            <div className={css.accountRow} data-account-row={account.apiKeyEnv}
              data-dragging={dragging === account.apiKeyEnv ? 'true' : undefined}
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
              }}
              onDragOver={event => {
                if (!reorderable || dragging === null || dragging === account.apiKeyEnv) return
                event.preventDefault()
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
                const box = event.currentTarget.getBoundingClientRect()
                setDropAt(event.clientY < box.top + box.height / 2 ? index : index + 1)
              }}
              onDrop={event => {
                const source = dragging
                const slot = dropAt
                setDragging(null)
                setDropAt(null)
                if (source === null || slot === null) return
                event.preventDefault()
                const from = state.entries.findIndex(entry => entry.apiKeyEnv === source)
                if (from >= 0) move(source, slot > from ? slot - 1 : slot)
              }}
              onDragEnd={() => { setDragging(null); setDropAt(null) }}>
              <div className={css.accountMain} data-account-main="">
                <button type="button" className={css.accountHandle} data-account-handle="" draggable={reorderable}
                  disabled={!reorderable} title={t('accountDragHandle', { name: label })}
                  aria-label={t('accountDragHandle', { name: label })}
                  onKeyDown={event => {
                    if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); move(account.apiKeyEnv, index - 1) }
                    if (event.key === 'ArrowDown' && index < total - 1) { event.preventDefault(); move(account.apiKeyEnv, index + 1) }
                  }}>
                  <GripIcon />
                </button>
                <strong className={css.accountName} title={label}>{label}</strong>
                <span className={css.accountState}>
                  <span className={css.accountDot} data-off={account.configured === false ? 'true' : undefined} />
                  {account.configured === undefined ? t(account.failed ? 'accountsStatusUnknown' : 'usageLoading') : account.configured ? t('keyConfigured') : t('keyMissing')}
                </span>
                {rolling ? <>
                  <span className={css.accountBar} role="progressbar" data-level={barLevel(rolling)}
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, rolling.percent)}
                    aria-label={`${label} ${t('usage_rolling')}`}>
                    <span className={css.accountBarFill} style={{ width: `${Math.min(100, rolling.percent)}%` }} />
                    {TICKS.map(at => <span key={at} className={css.accountBarTick} style={{ left: `${at}%` }} />)}
                  </span>
                  <span className={css.accountPercent}>{rolling.percent}%</span>
                  <span className={css.accountReset}>{resetText(rolling.resetsAt, t)}</span>
                </> : <span className={css.accountIdle}>{account.configured === false
                  ? t('accountConfigureHint') : t(account.loading ? 'usageLoading' : 'usageUnavailable')}</span>}
                <button type="button" className={css.accountToggle} aria-expanded={expanded} aria-controls={panelId}
                  aria-label={t(expanded ? 'accountsDetailsHide' : 'accountsDetails', { name: label })}
                  onClick={() => { setDetails(expanded ? null : account.apiKeyEnv) }}>
                  <ChevronDown className={expanded ? css.chevronOpen : css.chevron} />
                </button>
              </div>
              {account.failed ? <div className={css.accountProblems} role="alert">
                <p className={css.failedNote}>{account.problem ?? t(account.stale ? 'usageStaleHint' : 'usageRefreshFailed')}</p>
                <button type="button" className={css.accountRetry} disabled={state.refreshing}
                  onClick={actions.loadAccounts}>{t('usageRetry')}</button>
              </div> : null}
              {expanded ? detail(account, label) : null}
              {editor?.ref === account.apiKeyEnv ? editorForm(label) : null}
            </div>
          </Fragment>
        })}
        {reorderable && dropAt === total ? <div className={css.accountDropLine} /> : null}
      </div>
      {editor ? (editor.kind === 'add' ? editorForm() : null)
        : <Button variant="outline" size="sm" disabled={disabled || total >= MAX_ACCOUNTS}
          onClick={() => { start({ kind: 'add' }) }}>{t('accountAdd')}</Button>}
      <div className={css.field}>
        <div className={css.head}><span className={css.label}>{t('accountAutoSwitch')}</span>
          <Switch checked={state.autoSwitch} disabled={disabled} label={t('accountAutoSwitch')}
            onChange={next => { void actions.setAutoSwitch(next) }} /></div>
        <p className={css.hint}>{t('accountAutoSwitchHint')}</p>
      </div>
    </div> : null}
  </section>
}
