/** Sidebar page tab: the full usage dashboard extracted from AnalyticsDialog. */
import type { GoAccount } from '../../contracts.ts'
import { AnalyticsDashboard } from '../AnalyticsDialog.tsx'
import type { PageViewProps } from './types.ts'
import css from './UsagePage.module.css'

/**
 * The dashboard only reads stable account metadata. Quota and status fields
 * belong to the accounts page, so passing them through would only add
 * re-renders for data this surface never displays.
 */
function toAccounts(entries: PageViewProps['state']['accounts']['entries']): GoAccount[] {
  return entries.map(({ id, name, apiKeyEnv }) => ({ id, name, apiKeyEnv }))
}

/** Page tab "Usage": the reusable dashboard, mounted without the dialog chrome. */
export function UsagePage(props: PageViewProps) {
  const { state, actions } = props
  const { readAnalytics, exportAnalytics, readAccountUsage } = actions.readers ?? {}
  // A host without the analytics remote still lists the tab; say so in place
  // instead of mounting a dashboard that can never load data.
  if (readAnalytics === undefined) {
    return (
      <div className={css.page}>
        <section className={css.unavailable} role="status">
          <p>{actions.t('analyticsUnavailable')}</p>
        </section>
      </div>
    )
  }
  return (
    <div className={css.page}>
      <AnalyticsDashboard
        variant="page"
        readAnalytics={readAnalytics}
        exportAnalytics={exportAnalytics}
        readQuota={readAccountUsage}
        accounts={toAccounts(state.accounts.entries)}
        activeRef={state.accounts.activeRef}
        theme={state.appliedAppearanceTheme}
        t={actions.t}
        getLocale={actions.getLocale}
      />
    </div>
  )
}
