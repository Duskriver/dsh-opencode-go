/** About tab: build facts, the project links and the diagnostics a bug report needs. */
import css from './AboutPage.module.css'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import { CLIENT_BUILD_INFO } from '../build-info.ts'
import { GoRowIcon } from '../GoMark.tsx'
import { formatDateTime } from '../presentation.ts'
import type { PageViewProps } from './types.ts'

const REPO_URL = 'https://github.com/Duskriver/dsh-opencode-go'
const DOCS_URL = 'https://github.com/Duskriver/dsh-opencode-go/blob/main/docs/advanced.md'
const CHANGELOG_URL = 'https://github.com/Duskriver/dsh-opencode-go/blob/main/CHANGELOG.md'

/** Redact endpoint URLs to protocol + host (never paths, queries, or credentials). */
function redactEndpoint(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'default'
  try {
    const parsed = new URL(trimmed)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return 'invalid'
  }
}

/** Redact proxy URLs to scheme only so credentials and local ports never leak. */
function redactProxy(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'none'
  try {
    return `${new URL(trimmed).protocol}//<redacted>`
  } catch {
    return 'configured'
  }
}

/** Build a safe, credential-free Markdown diagnostics block for issue reports. */
export function buildDiagnosticsMarkdown(
  state: PageViewProps['state'],
  historyAvailable: boolean,
): string {
  const entries = state.accounts.entries
  const configured = entries.filter(entry => entry.configured === true).length
  const unreadable = entries.filter(entry => entry.failed === true).length
  const modelStatus = state.models.status === 'ready'
    ? `ready (${state.models.count}${state.models.stale ? ', stale' : ''})`
    : state.models.status
  const lines = [
    '### dsh-opencode-go diagnostics',
    `- Version: v${CLIENT_BUILD_INFO.version} (${CLIENT_BUILD_INFO.packageName})`,
    `- Minimum host: ${CLIENT_BUILD_INFO.minHost}`,
    `- Service enabled: ${state.enabled ? 'yes' : 'no'}`,
    `- Free channel: ${state.freeEnabled.text === 'true' ? 'enabled' : 'disabled'}`,
    `- Sidebar entry: ${state.sidebarEntry ? 'enabled' : 'disabled'}`,
    `- Console history: ${historyAvailable ? 'available' : 'unavailable'}`,
    `- Theme / Pill: ${state.appliedAppearanceTheme} / ${state.usagePillStyle.text} (border=${state.usagePillBorder.text}, display=${state.usageDisplay.text})`,
    `- Accounts: ${configured}/${entries.length} configured${unreadable > 0 ? `, ${unreadable} unreadable` : ''}, autoSwitch=${state.accounts.autoSwitch ? 'on' : 'off'}`,
    `- Models catalog: ${modelStatus}`,
    `- Endpoints: go=${redactEndpoint(state.baseURL.text)}, free=${redactEndpoint(state.freeBaseURL.text)}, proxy=${redactProxy(state.proxyURL.text)}`,
  ]
  if (state.models.status === 'failed' && state.models.message) {
    lines.push(`- Catalog error: ${state.models.message}`)
  } else if (state.models.status === 'ready' && state.models.message) {
    lines.push(`- Catalog notice: ${state.models.message}`)
  }
  return lines.join('\n')
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back to execCommand when clipboard permission is denied.
  }
  if (typeof document === 'undefined') return false
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  let copied = false
  try {
    copied = typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    copied = false
  } finally {
    textarea.remove()
  }
  return copied
}

/** One definition row of the about tables. */
function InfoRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }): ReactNode {
  return <div className={css.row}>
    <dt className={css.rowLabel}>{label}</dt>
    <dd className={mono ? `${css.rowValue} ${css.rowValueMono}` : css.rowValue}>{value}</dd>
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
 * diagnostics with a credential-free Markdown summary copy action.
 * @param props - the snapshot, the business face and the locale.
 * @returns the two information cards.
 */
export function AboutPage({ state, actions, locale }: PageViewProps): ReactNode {
  const t = actions.t
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { if (copyTimer.current !== undefined) clearTimeout(copyTimer.current) }, [])
  const total = state.accounts.entries.length
  const history = actions.readers?.readAnalytics !== undefined
  const freeEnabled = state.freeEnabled.text === 'true'
  const refreshedAt = state.accounts.entries.reduce((latest, entry) => Math.max(latest, entry.updatedAt ?? 0), 0)
  const refreshed = refreshedAt > 0
    ? formatDateTime(refreshedAt, locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : t('aboutNa')
  const onCopyDiagnostics = async (): Promise<void> => {
    const ok = await copyText(buildDiagnosticsMarkdown(state, history))
    setCopyState(ok ? 'copied' : 'failed')
    if (copyTimer.current !== undefined) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => { setCopyState('idle') }, 2500)
  }
  return <div className={css.grid}>
    <section className={css.card}>
      <div className={css.cardHead}>
        <span className={css.titleLead}>
          <span className={css.aboutMark} aria-hidden="true"><GoRowIcon size={16} /></span>
          <h2 className={css.cardTitle}>{t('aboutTitle')}</h2>
        </span>
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
      <div className={css.divider} />
      <div className={css.diagFoot}>
        <p className={css.diagHint}>{t('aboutExportHint')}</p>
        <Button variant="outline" size="sm" onClick={() => { void onCopyDiagnostics() }}>
          {t(copyState === 'copied' ? 'aboutCopiedDiagnostics'
            : copyState === 'failed' ? 'aboutCopyFailed' : 'aboutCopyDiagnostics')}
        </Button>
      </div>
    </section>
  </div>
}
