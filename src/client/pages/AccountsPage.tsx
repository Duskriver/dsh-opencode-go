/**
 * Accounts sub-page of the OpenCode Go console.
 *
 * The card below already owns the whole account flow (add, rename, replace key,
 * remove, drag order, auto fallback), so the page opens it by default and adds
 * only the credential note. A page-level tool row would duplicate the card's own
 * refresh and add entries.
 */
import { AccountsCard } from '../Section.tsx'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Accounts tab: the reusable account card, opened so the rows are visible. */
export function AccountsPage({ state, actions, locale }: PageViewProps) {
  const t = actions.t
  return <div className={css.page}>
    <AccountsCard state={state.accounts} actions={actions} writable={state.writable} t={t} locale={locale}
      defaultOpen surface="page" />
    <p className={css.footnote}>{t('accountsPageHint')}</p>
  </div>
}
