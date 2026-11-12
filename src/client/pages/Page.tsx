/** Sidebar `main` page shell: brand header, tab strip, crash boundary and save bar. */
import css from './Page.module.css'
import { Component, useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { GoLogo } from '../GoMark.tsx'
import { themeStyle, useGoThemeTokens } from '../presentation.ts'
import { setPageTab, usePageTab } from './nav.ts'
import {
  PAGE_TABS,
  TAB_COPY,
  type PageActions,
  type PageShellProps,
  type PageTab,
  type PageTranslate,
  type PageViewProps,
} from './types.ts'
import { AboutPage } from './AboutPage.tsx'
import { AccountsPage } from './AccountsPage.tsx'
import { AppearancePage } from './AppearancePage.tsx'
import { ModelsPage } from './ModelsPage.tsx'
import { OverviewPage } from './OverviewPage.tsx'
import { UsagePage } from './UsagePage.tsx'

/**
 * The injected face once every business seat is present. The host delivers the
 * `hooks.opencodeGo` compartment as the bound `useOpencodeGo` selector hook, so
 * the shell reads the snapshot through that and rebuilds the plain face that the
 * sub-pages take.
 */
type PageSeats = PageShellProps & Required<Pick<PageShellProps,
  | 'useOpencodeGo' | 't'
  | 'edit' | 'editModelLimits' | 'resetField' | 'save' | 'discard'
  | 'loadModels' | 'setEnabled' | 'setModelEnabled'
  | 'loadAccounts' | 'addAccount' | 'renameAccount' | 'removeAccount'
  | 'selectAccount' | 'setAutoSwitch' | 'replaceAccountKey' | 'moveAccount'>>

/**
 * A registration missing one seat would render controls that cannot act, so the
 * page declines to render at all instead of showing dead buttons.
 * @param props - the flat inject face delivered by the host outlet.
 * @returns whether every business seat is bound.
 */
function hasEverySeat(props: PageShellProps): props is PageSeats {
  return props.useOpencodeGo !== undefined && props.t !== undefined
    && props.edit !== undefined && props.editModelLimits !== undefined && props.resetField !== undefined
    && props.save !== undefined && props.discard !== undefined
    && props.loadModels !== undefined && props.setEnabled !== undefined && props.setModelEnabled !== undefined
    && props.loadAccounts !== undefined && props.addAccount !== undefined && props.renameAccount !== undefined
    && props.removeAccount !== undefined && props.selectAccount !== undefined && props.setAutoSwitch !== undefined
    && props.replaceAccountKey !== undefined && props.moveAccount !== undefined
}

/**
 * Render the OpenCode Go console page.
 * @param props - the flat inject face plus the host's selector hook.
 * @returns the page, or null while the registration is incomplete.
 */
export function GoPage(props: PageShellProps): ReactNode {
  if (!hasEverySeat(props)) return null
  return <Loaded seats={props} />
}

/** The page once every injected seat is present. */
function Loaded({ seats }: { seats: PageSeats }): ReactNode {
  const state = seats.useOpencodeGo(snapshot => snapshot)
  const tab = usePageTab()
  const tokens = useGoThemeTokens(state.appliedAppearanceTheme)
  const scroller = useRef<HTMLDivElement | null>(null)
  // The tab store outlives the host panel, so a re-entry can restore a tab the
  // reader left halfway down: every tab starts at its own top instead.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }) }, [tab])
  const locale = seats.getLocale?.()
  const actions: PageActions = {
    edit: seats.edit,
    editModelLimits: seats.editModelLimits,
    resetField: seats.resetField,
    save: seats.save,
    discard: seats.discard,
    loadModels: seats.loadModels,
    setEnabled: seats.setEnabled,
    setModelEnabled: seats.setModelEnabled,
    loadAccounts: seats.loadAccounts,
    addAccount: seats.addAccount,
    resetAddition: seats.resetAddition,
    renameAccount: seats.renameAccount,
    removeAccount: seats.removeAccount,
    selectAccount: seats.selectAccount,
    setAutoSwitch: seats.setAutoSwitch,
    replaceAccountKey: seats.replaceAccountKey,
    moveAccount: seats.moveAccount,
    t: seats.t,
    getLocale: seats.getLocale,
    readers: seats.readers,
    // The host panel is already open when a sub-page calls this, so switching the
    // tab is the whole navigation; the sidebar row keeps owning the open axis.
    openPage: next => { setPageTab(next ?? 'overview') },
  }
  const view: PageViewProps = { state, actions, locale, go: setPageTab }
  const statusText = state.enabled ? seats.t('pageStatusOn') : seats.t('pageStatusOff')
  const ready = state.status === 'ready'
  return <div className={css.root} data-opencode-go-page="" style={themeStyle(tokens)}>
    <div className={css.scroller} ref={scroller}>
      <div className={css.page}>
        <header className={css.head}>
          <div className={css.headMain}>
            <p className={css.kicker}>
              <GoLogo size={16} />
              <span className={css.kickerText}>{KICKER}</span>
            </p>
            <h1 className={css.title}>{seats.t('pageTitle')}</h1>
            <p className={css.sub}>{seats.t('pageSubtitle')}</p>
          </div>
          <div className={css.headActions}>
            <span className={css.statusChip} data-on={state.enabled ? 'true' : 'false'} title={statusText}>
              <span className={css.statusDot} aria-hidden="true" />
              <span className={css.statusText}>{statusText}</span>
            </span>
          </div>
        </header>
        {ready ? <div className={css.tabs} role="tablist" aria-label={seats.t('pageTabsLabel')}>
          {PAGE_TABS.map((item, index) => <button key={item} type="button" role="tab"
            id={tabId(item)} aria-selected={tab === item} aria-controls={panelId(item)}
            tabIndex={tab === item ? 0 : -1} className={css.tab}
            onClick={() => { setPageTab(item) }}
            onKeyDown={event => {
              const next = event.key === 'ArrowLeft' ? PAGE_TABS[(index + PAGE_TABS.length - 1) % PAGE_TABS.length]
                : event.key === 'ArrowRight' ? PAGE_TABS[(index + 1) % PAGE_TABS.length]
                  : event.key === 'Home' ? PAGE_TABS[0]
                    : event.key === 'End' ? PAGE_TABS[PAGE_TABS.length - 1] : undefined
              if (next === undefined) return
              event.preventDefault()
              setPageTab(next)
              document.getElementById(tabId(next))?.focus()
            }}>
            {seats.t(TAB_COPY[item])}
          </button>)}
        </div> : null}
        {state.status === 'loading' ? <p className={css.statusNote} role="status">{seats.t('pageLoading')}</p> : null}
        {state.status === 'unavailable' ? <p className={css.statusNote}>{seats.t('pageUnavailable')}</p> : null}
        {ready ? <div key={tab} className={css.body} role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
          <PageBoundary t={seats.t} onRetry={() => { setPageTab('overview') }}>
            <PageBody tab={tab} view={view} />
          </PageBoundary>
        </div> : null}
        {state.dirty || state.failed ? <div className={css.saveBar}>
          <div className={css.saveNote}>
            {state.failed ? <p className={css.saveFailed} role="alert">{seats.t('savedFailed')}</p> : null}
            {!state.writable ? <p className={css.saveReadOnly}>{seats.t('readOnly')}</p> : null}
          </div>
          <div className={css.saveActions}>
            <Button variant="primary" size="md"
              disabled={!state.writable || !state.dirty || state.invalid || state.saving || state.pickerSaving}
              onClick={seats.save}>{state.saving ? seats.t('saving') : seats.t('save')}</Button>
            <Button variant="outline" size="md"
              disabled={!state.writable || !state.dirty || state.saving}
              onClick={seats.discard}>{seats.t('discard')}</Button>
          </div>
        </div> : null}
      </div>
    </div>
  </div>
}

/** Every tab mounts the same way: one PageViewProps, one sibling component. */
function PageBody({ tab, view }: { tab: PageTab; view: PageViewProps }): ReactNode {
  switch (tab) {
    case 'overview': return <OverviewPage {...view} />
    case 'usage': return <UsagePage {...view} />
    case 'accounts': return <AccountsPage {...view} />
    case 'models': return <ModelsPage {...view} />
    case 'appearance': return <AppearancePage {...view} />
    case 'about': return <AboutPage {...view} />
  }
}

/**
 * Brand line above the title. Deliberately a product marker rather than a second
 * copy of the page name below it, so it stays out of the dictionary.
 */
const KICKER = 'OpenCode Go · DSH plugin'

const tabId = (tab: PageTab): string => `opencode-go-page-tab-${tab}`
const panelId = (tab: PageTab): string => `opencode-go-page-panel-${tab}`

/**
 * One crashed tab must not take the whole panel down with it: the header, the tab
 * strip and the save bar stay usable, and Try again returns to Overview because
 * the tab that threw is the one just left behind.
 */
class PageBoundary extends Component<{ t: PageTranslate; onRetry: () => void; children?: ReactNode }, { failed: boolean }> {
  constructor(props: { t: PageTranslate; onRetry: () => void; children?: ReactNode }) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  private retry = (): void => {
    this.setState({ failed: false })
    this.props.onRetry()
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return <div className={css.crash} role="alert">
      <h2 className={css.crashTitle}>{this.props.t('pageCrashTitle')}</h2>
      <p className={css.crashHint}>{this.props.t('pageCrashHint')}</p>
      <Button variant="outline" size="sm" onClick={this.retry}>{this.props.t('pageRetry')}</Button>
    </div>
  }
}
