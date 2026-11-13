/**
 * Shared contracts between the host slot registration, the page shell and the
 * sub-pages. Kept in one file so the registration surface in \`index.ts\` and
 * every page agree on a single injected shape.
 */
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  AnalyticsExport,
  AnalyticsQuery,
  AnalyticsReport,
  GoUsage,
} from '../../contracts.ts'
import type { OpencodeGoSectionFace, OpencodeGoSectionState } from '../controller.ts'
import type { en } from '../presentation.ts'
import type { OpencodeGoSectionInjected } from '../Section.tsx'

/** Tabs of the OpenCode Go console page, in reading order. */
export const PAGE_TABS = ['overview', 'usage', 'accounts', 'models', 'appearance', 'about'] as const

export type PageTab = typeof PAGE_TABS[number]

/** Copy key of each tab's label. */
export const TAB_COPY: Readonly<Record<PageTab, keyof typeof en>> = {
  overview: 'tabOverview',
  usage: 'tabUsage',
  accounts: 'tabAccounts',
  models: 'tabModels',
  appearance: 'tabAppearance',
  about: 'tabAbout',
}

/**
 * Reader surface the usage dashboard needs. Every member is optional: hosts
 * without the analytics remote simply do not bind it, and the page degrades to
 * a notice instead of failing to register.
 */
export interface PageReaders {
  readUsage?: () => Promise<GoUsage>
  readAccountUsage?: (ref: string) => Promise<GoUsage>
  readAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsReport>
  exportAnalytics?: (query: AnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsExport>
}

/** Static injected face of the page slot: the settings face plus the readers. */
export interface PageInjected extends OpencodeGoSectionInjected {
  readers: PageReaders
}

/** Props delivered by the host slot outlet (inject face spread flat). */
export type PageShellProps = Partial<InjectFace<PageInjected>>

/** Copy lookup used by the pages (same shape as the settings section's \`t\`). */
export type PageTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string

/**
 * Business face every sub-page receives from the shell. The snapshot itself is
 * a separate prop, so the controller's `hooks` compartment (which the host only
 * exposes as the bound `useOpencodeGo` selector) is intentionally omitted here.
 */
export interface PageActions extends Omit<OpencodeGoSectionFace, 'hooks'> {
  t: PageTranslate
  getLocale?: () => string
  readers?: PageReaders
  openPage?: (tab?: PageTab) => void
}

/** Props every sub-page receives from the shell. */
export interface PageViewProps {
  state: OpencodeGoSectionState
  actions: PageActions
  locale?: string
  /** Switch the page tab (the host panel is already open). */
  go: (tab: PageTab) => void
}
