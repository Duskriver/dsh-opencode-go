import { Fragment, useEffect, useState } from 'react'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GoAccountsActions, GoAccountsState } from './accounts-controller.ts'
import { MAX_ACCOUNTS } from '../accounts.ts'
import type { en } from './locales.ts'
import css from './Section.module.css'

type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string
type Editor = { kind: 'add' | 'rename' | 'key' | 'remove'; ref?: string }
/** The three quota windows, in the order the panel reads them. */
const WINDOWS = ['rolling', 'weekly', 'monthly'] as const

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

/** The drag handle: six dots, the page's reorder affordance. */
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
 * countdown; everything else opens under the row. Dragging a row's handle — or the
 * arrow keys on it — reorders the list, and the first row is the preferred account.
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
  const preferred = state.entries.find(entry => entry.apiKeyEnv === state.activeRef)
  const reorderable = !disabled && total > 1
  useEffect(() => {
    actions.loadAccounts()
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') actions.loadAccounts() }, 60_000)
    return () => { clearInterval(timer) }
  }, [actions.loadAccounts])
  const start = (next: Editor, label = '') => { setEditor(next); setName(label); setKey('') }
  const cancel = () => { setEditor(null); setName(''); setKey('') }
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
  return <section className={open ? css.card : css.card + ' ' + css.cardFolded}>
    <div className={css.cardHead}>
      <button type="button" className={css.cardTrigger} aria-expanded={open} aria-controls="opencode-go-accounts"
        onClick={() => { setOpen(!open) }}>
        <span className={css.cardTitle}>{t('accountsTitle')}</span>
        <span className={css.cardSub}>{summary}</span>
        {total > 0 ? <Tag tone={ready === total ? 'success' : 'warning'}>{t('accountsAvailability', { ready, total })}</Tag> : null}
        <ChevronDown className={open ? css.chevronOpen : css.chevron} />
      </button>
      <span className={css.trailing}><Button variant="outline" size="sm" disabled={state.refreshing}
        onClick={actions.loadAccounts}>{t(state.refreshing ? 'usageRefreshing' : 'accountsRefresh')}</Button></span>
    </div>
    {open ? <div id="opencode-go-accounts" className={css.cardBody}>
      <p className={css.hint}>{t('accountsHint')}</p>
      {total > 0 ? <p className={css.hint}>{t('accountsOrderHint')}</p> : null}
      {state.blocked ? <p className={css.hint}>{t('accountsBlocked')}</p> : null}
      {state.failure ? <p className={css.failedNote} role="alert">{t(state.failure === 'cleanup' ? 'accountsCleanupFailed'
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
            <div className={css.accountRow} data-dragging={dragging === account.apiKeyEnv ? 'true' : undefined}
              onDragStart={event => {
                // Only the handle starts a drag: the row itself keeps its text and buttons usable.
                if (!reorderable || (event.target as HTMLElement | null)?.closest?.('[data-account-handle]') == null) {
                  event.preventDefault()
                  return
                }
                if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', account.apiKeyEnv) }
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
              <div className={css.accountMain}>
                <button type="button" className={css.accountHandle} data-account-handle="" disabled={!reorderable}
                  aria-label={t('accountDragHandle', { name: label })}
                  onKeyDown={event => {
                    if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); move(account.apiKeyEnv, index - 1) }
                    if (event.key === 'ArrowDown' && index < total - 1) { event.preventDefault(); move(account.apiKeyEnv, index + 1) }
                  }}>
                  <GripIcon />
                </button>
                <strong className={css.accountName}>{label}</strong>
                <span className={css.accountState}>
                  <span className={css.accountDot} data-off={account.configured === false ? 'true' : undefined} />
                  {account.configured === undefined ? t('usageLoading') : account.configured ? t('keyConfigured') : t('keyMissing')}
                </span>
                <span className={css.accountSpacer} />
                {rolling ? <>
                  <span className={css.accountPercent}>{rolling.percent}%</span>
                  <progress className={css.accountProgress} max={100} value={Math.min(100, rolling.percent)}
                    aria-label={`${label} ${t('usage_rolling')}`} />
                  <span className={css.accountReset}>{resetText(rolling.resetsAt, t)}</span>
                </> : <span className={css.accountReset}>{account.configured === false
                  ? t('accountConfigureHint') : t(account.loading ? 'usageLoading' : 'usageUnavailable')}</span>}
                <button type="button" className={css.accountToggle} aria-expanded={expanded} aria-controls={panelId}
                  aria-label={t(expanded ? 'accountsDetailsHide' : 'accountsDetails', { name: label })}
                  onClick={() => { setDetails(expanded ? null : account.apiKeyEnv) }}>
                  <ChevronDown className={expanded ? css.chevronOpen : css.chevron} />
                </button>
              </div>
              {account.failed ? <div className={css.accountProblems}>
                <p className={css.failedNote}>{t(account.stale ? 'usageStaleHint' : 'usageRefreshFailed')}</p>
              </div> : null}
              {expanded ? <div id={panelId} className={css.accountDetail}>
                {account.usage ? <div className={css.accountUsage}>
                  {WINDOWS.map(window => <div key={window}>
                    <span>{t(`usage_${window}`)} · {account.usage![window].percent}%</span>
                    <progress aria-label={`${label} ${t(`usage_${window}`)}`} max={100} value={Math.min(100, account.usage![window].percent)} />
                    <span className={css.hint}>{t('usageResets')} {new Date(account.usage![window].resetsAt).toLocaleString(locale)}</span>
                  </div>)}
                </div> : <p className={css.hint}>{t(account.loading ? 'usageLoading' : 'usageUnavailable')}</p>}
                {account.updatedAt ? <p className={css.hint}>{t('usageLastUpdated')} {new Date(account.updatedAt).toLocaleString(locale)}</p> : null}
                <div className={css.accountActions}>
                  <Button variant="outline" size="sm" disabled={!reorderable || index === 0}
                    onClick={() => { move(account.apiKeyEnv, index - 1) }}>{t('accountMoveUp')}</Button>
                  <Button variant="outline" size="sm" disabled={!reorderable || index === total - 1}
                    onClick={() => { move(account.apiKeyEnv, index + 1) }}>{t('accountMoveDown')}</Button>
                  <Button variant="outline" size="sm" disabled={disabled} onClick={() => { start({ kind: 'rename', ref: account.apiKeyEnv }, label) }}>{t('accountRename')}</Button>
                  <Button variant="outline" size="sm" disabled={state.busy || state.blocked || account.writable === false} onClick={() => { start({ kind: 'key', ref: account.apiKeyEnv }, label) }}>{t('accountReplaceKey')}</Button>
                  <Button variant="outline" size="sm" disabled={disabled} onClick={() => { start({ kind: 'remove', ref: account.apiKeyEnv }, label) }}>{t('accountRemove')}</Button>
                </div>
              </div> : null}
            </div>
          </Fragment>
        })}
        {reorderable && dropAt === total ? <div className={css.accountDropLine} /> : null}
      </div>
      {editor ? <form className={css.accountEditor} onSubmit={event => { event.preventDefault(); void submit() }}>
        <strong>{t(editor.kind === 'add' ? 'accountAdd' : editor.kind === 'rename' ? 'accountRename'
          : editor.kind === 'key' ? 'accountReplaceKey' : 'accountRemove')}</strong>
        {editor.kind === 'remove' ? <p className={css.hint}>{t('accountRemoveHint', { name })}</p> : null}
        {editor.kind === 'add' || editor.kind === 'rename' ? <label className={css.field}>{t('accountName')}
          <input className={css.input} value={name} maxLength={80} required disabled={state.busy}
            onChange={event => { setName(event.target.value) }} />
        </label> : null}
        {editor.kind === 'add' || editor.kind === 'key' ? <><label className={css.field}>{t('keyLabel')}
          <input className={css.input} type="password" autoComplete="off" value={key} required disabled={state.busy}
            onChange={event => { setKey(event.target.value) }} />
        </label><p className={css.hint}>{t('accountKeyHint')}</p></> : null}
        <div className={css.accountActions}>
          <button className={css.accountSubmit} type="submit" disabled={editor.kind === 'key' ? state.busy || state.blocked : disabled}>{t(state.busy ? 'saving' : 'accountConfirm')}</button>
          <Button variant="outline" size="sm" disabled={state.busy} onClick={cancel}>{t('accountCancel')}</Button>
        </div>
      </form> : <Button variant="outline" size="sm" disabled={disabled || total >= MAX_ACCOUNTS}
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
