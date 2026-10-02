import { useEffect, useState } from 'react'
import { Button, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GoAccountsActions, GoAccountsState } from './accounts-controller.ts'
import { MAX_ACCOUNTS } from '../accounts.ts'
import type { en } from './locales.ts'
import css from './Section.module.css'

type Translate = (key: keyof typeof en, params?: Record<string, unknown>) => string
type Editor = { kind: 'add' | 'rename' | 'key' | 'remove'; ref?: string }

export function AccountsCard({ state, actions, writable, t, locale }: {
  state: GoAccountsState
  actions: GoAccountsActions
  writable: boolean
  t: Translate
  locale?: string
}) {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const disabled = state.busy || state.blocked || !writable
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
  return <section className={css.card}>
    <div className={css.cardHead}>
      <h3 className={css.cardTitle}>{t('accountsTitle')}</h3>
      <span className={css.trailing}><Button variant="outline" size="sm" disabled={state.refreshing}
        onClick={actions.loadAccounts}>{t(state.refreshing ? 'usageRefreshing' : 'accountsRefresh')}</Button></span>
    </div>
    <div className={css.cardBody}>
      <p className={css.hint}>{t('accountsHint')}</p>
      {state.blocked ? <p className={css.hint}>{t('accountsBlocked')}</p> : null}
      {state.failure ? <p className={css.failedNote} role="alert">{t(state.failure === 'cleanup' ? 'accountsCleanupFailed'
        : state.failure === 'read' ? 'accountsReadFailed' : 'accountsWriteFailed')}</p> : null}
      {!state.entries.length ? <p className={css.hint}>{t('accountsEmpty')}</p> : null}
      <div className={css.accounts}>
        {state.entries.map(account => {
          const label = account.name || t('accountDefault')
          const current = account.apiKeyEnv === state.activeRef
          return <div className={css.account} key={account.id}>
            <div className={css.head}>
              <strong className={css.label}>{label}</strong>
              {current ? <Tag tone="success">{t('accountCurrent')}</Tag> : <Button variant="outline" size="sm" disabled={disabled || account.configured === false}
                onClick={() => { void actions.selectAccount(account.apiKeyEnv) }}>{t('accountUse')}</Button>}
            </div>
            <p className={css.hint}>{account.configured === undefined ? t('usageLoading') : account.configured ? t('keyConfigured') : t('keyMissing')}</p>
            {account.usage ? <div className={css.accountUsage}>
              {(['rolling', 'weekly', 'monthly'] as const).map(window => <div key={window}>
                <span>{t(`usage_${window}`)} · {account.usage![window].percent}%</span>
                <progress aria-label={`${label} ${t(`usage_${window}`)}`} max={100} value={Math.min(100, account.usage![window].percent)} />
                <span className={css.hint}>{t('usageResets')} {new Date(account.usage![window].resetsAt).toLocaleString(locale)}</span>
              </div>)}
            </div> : account.configured ? <p className={css.hint}>{t(account.loading ? 'usageLoading' : 'usageUnavailable')}</p> : null}
            {account.failed ? <p className={css.failedNote}>{t(account.stale ? 'usageStaleHint' : 'usageRefreshFailed')}</p> : null}
            {account.updatedAt ? <p className={css.hint}>{t('usageLastUpdated')} {new Date(account.updatedAt).toLocaleString(locale)}</p> : null}
            <div className={css.accountActions}>
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => { start({ kind: 'rename', ref: account.apiKeyEnv }, label) }}>{t('accountRename')}</Button>
              <Button variant="outline" size="sm" disabled={state.busy || state.blocked || account.writable === false} onClick={() => { start({ kind: 'key', ref: account.apiKeyEnv }, label) }}>{t('accountReplaceKey')}</Button>
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => { start({ kind: 'remove', ref: account.apiKeyEnv }, label) }}>{t('accountRemove')}</Button>
            </div>
          </div>
        })}
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
      </form> : <Button variant="outline" size="sm" disabled={disabled || state.entries.length >= MAX_ACCOUNTS}
        onClick={() => { start({ kind: 'add' }) }}>{t('accountAdd')}</Button>}
      <div className={css.field}>
        <div className={css.head}><span className={css.label}>{t('accountAutoSwitch')}</span>
          <Switch checked={state.autoSwitch} disabled={disabled} label={t('accountAutoSwitch')}
            onChange={next => { void actions.setAutoSwitch(next) }} /></div>
        <p className={css.hint}>{t('accountAutoSwitchHint')}</p>
      </div>
    </div>
  </section>
}
