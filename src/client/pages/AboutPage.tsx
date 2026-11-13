/** About tab: build facts, the project links and the diagnostics a bug report needs. */
import css from './AboutPage.module.css'
import type { ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { CLIENT_BUILD_INFO } from '../build-info.ts'
import { formatDateTime } from '../presentation.ts'
import type { PageViewProps } from './types.ts'

const REPO_URL = 'https://github.com/Duskriver/dsh-opencode-go'
const DOCS_URL = 'https://github.com/Duskriver/dsh-opencode-go/blob/main/docs/development.md'
const CHANGELOG_URL = 'https://github.com/Duskriver/dsh-opencode-go/blob/main/CHANGELOG.md'

/** One definition row of the about tables. */
function InfoRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }): ReactNode {
  return <div className={css.row}>
    <dt className={css.rowLabel}>{label}</dt>
    <dd className={mono ? css.rowValueMono : css.rowValue}>{value}</dd>
  </div>
}

/** Availability tag shared by the diagnostics rows. */
function StateTag({ available, t, on = 'aboutOk', off = 'aboutOff' }: {
  available: boolean
  t: PageViewProps['actions']['t']
  on?: 'aboutOk' | 'pageStatusOn'
  off?: 'aboutOff' | 'pageStatusOff'
}): ReactNode {
  return <Tag tone={available ? 'success' : 'quiet'}>{t(available ? on : off)}</Tag>
}

/**
 * Render the About tab: the build facts with their links, then the live
 * diagnostics. There is no export-log action on purpose: the client bundle has
 * no log sink, and a button that only promised one would be a dead control.
 * @param props - the snapshot, the business face and the locale.
 * @returns the two information cards.
 */
export function AboutPage({ state, actions, locale }: PageViewProps): ReactNode {
  const t = actions.t
  const total = state.accounts.entries.length
  const history = actions.readers?.readAnalytics !== undefined
  const freeEnabled = state.freeEnabled.text === 'true'
  const refreshedAt = state.accounts.entries.reduce((latest, entry) => Math.max(latest, entry.updatedAt ?? 0), 0)
  const refreshed = refreshedAt > 0
    ? formatDateTime(refreshedAt, locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : t('aboutNa')
  return <div className={css.grid}>
    <section className={css.card}>
      <div className={css.cardHead}>
        <h2 className={css.cardTitle}>{t('aboutTitle')}</h2>
        <Tag tone="neutral">v{CLIENT_BUILD_INFO.version}</Tag>
      </div>
      <dl className={css.rows}>
        <InfoRow label={t('aboutVersion')} value={'v' + CLIENT_BUILD_INFO.version} mono />
        <InfoRow label={t('aboutPackage')} value={CLIENT_BUILD_INFO.packageName} mono />
        <InfoRow label={t('aboutHost')} value={CLIENT_BUILD_INFO.minHost} mono />
        <InfoRow label={t('aboutEntry')} value={state.sidebarEntry ? t('aboutEntryValue') : t('aboutEntryHidden')} mono />
        <InfoRow label={t('aboutBuild')} value={CLIENT_BUILD_INFO.build} />
      </dl>
      <div className={css.divider} />
      <div className={css.links}>
        <a className={css.link} href={REPO_URL} target="_blank" rel="noopener noreferrer">
          {t('aboutRepo')}<span aria-hidden="true">↗</span>
        </a>
        <a className={css.link} href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          {t('aboutDocs')}<span aria-hidden="true">↗</span>
        </a>
        <a className={css.link} href={CHANGELOG_URL} target="_blank" rel="noopener noreferrer">
          {t('aboutChangelog')}<span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
    <section className={css.card}>
      <div className={css.cardHead}>
        <h2 className={css.cardTitle}>{t('aboutDiagnostics')}</h2>
      </div>
      <dl className={css.rows}>
        <InfoRow label={t('nav')} value={<StateTag available={state.enabled} t={t} on="pageStatusOn" off="pageStatusOff" />} />
        <InfoRow label={t('groupFree')} value={<StateTag available={freeEnabled} t={t} />} />
        <InfoRow label={t('aboutHistory')} value={<StateTag available={history} t={t} />} />
        <InfoRow label={t('accountsTitle')} value={String(total)} mono />
        <InfoRow label={t('aboutLastRefresh')} value={refreshed} mono />
      </dl>
    </section>
  </div>
}
