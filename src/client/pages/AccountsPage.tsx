/**
 * Accounts sub-page of the OpenCode Go console.
 *
 * The card below already owns the whole account flow (add, rename, replace key,
 * remove, drag order, auto fallback), so the page opens it by default and adds
 * only the credential note. A page-level tool row would duplicate the card's own
 * refresh and add entries.
 */
import { AccountsCard } from '../Section.tsx'
import { DEFAULT_GO_PLAN, GO_PLANS, type GoPlan } from '../../contracts.ts'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Accounts tab: the reusable account card, opened so the rows are visible. */
export function AccountsPage({ state, actions, locale }: PageViewProps) {
  const t = actions.t
  const fallbackPlan: GoPlan = (GO_PLANS as readonly string[]).includes(state.goPlan?.text ?? '')
    ? (state.goPlan.text as GoPlan) : DEFAULT_GO_PLAN
  return <div className={css.page}>
    <AccountsCard state={state.accounts} actions={actions} writable={state.writable} t={t} locale={locale}
      fallbackPlan={fallbackPlan} defaultOpen surface="page" />
    <p className={css.footnote}>{t('accountsPageHint')}</p>
  </div>
}
