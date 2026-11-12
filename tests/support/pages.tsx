/**
 * Fixtures for the OpenCode Go console page: one settled settings snapshot, one
 * complete injected business face, and a PageViewProps builder every sub-page
 * test can start from. Mirrors the settings section fixtures in
 * tests/settings.client.spec.tsx without importing that spec's internals.
 *
 * Also builds the flat inject face that GoPage receives from the host outlet,
 * which is the same business face with the hooks.opencodeGo compartment bound
 * into a useOpencodeGo selector hook (see InjectFace in the slot package).
 */
import { vi } from 'vitest'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type {
  GoAccountsState,
  OpencodeGoModels,
  OpencodeGoSectionState,
} from '../../src/client/controller.ts'
import type { GoAccountView, GoModel } from '../../src/contracts.ts'
import type { PageActions, PageReaders, PageShellProps, PageViewProps } from '../../src/client/pages/types.ts'
import { en } from '../../src/client/presentation.ts'
import type { AnalyticsQuery, AnalyticsReport } from '../../src/contracts.ts'
import { createAnalyticsReport } from './analytics.ts'
import { bindSnapshotSelector } from './client.tsx'

export function field(text: string, overrides: Partial<OpencodeGoSectionState['baseURL']> = {}): OpencodeGoSectionState['baseURL'] {
  return { text, overridden: false, invalid: false, ...overrides }
}

/** A ready, writable settings snapshot with the defaults the Host would settle to. */
export function pageStateOf(overrides: Partial<OpencodeGoSectionState> = {}): OpencodeGoSectionState {
  return {
    status: 'ready',
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    enabled: true,
    appliedAppearanceTheme: 'native',
    modelVisibility: {},
    pickerSaving: false,
    pickerFailed: false,
    enabledFailed: false,
    usageDisplay: field('auto'),
    usagePillStyle: field('badge'),
    appearanceTheme: field('native'),
    showSidebarQuota: field('false'),
    freeEnabled: field('false'),
    freeBaseURL: field('https://opencode.ai/inference/v1'),
    baseURL: field('https://opencode.ai/zen/go/v1'),
    proxyURL: field(''),
    refreshMinutes: field('60'),
    streamIdleTimeoutMs: field('300000'),
    requestPreparationTimeoutMs: field('60000'),
    requestTimeoutMs: field('1800000'),
    maxImages: field(''),
    maxRequestImageBytes: field('20971520'),
    requestImagePixelBudget: field('4194304'),
    requestImageMaxBytes: field('1048576'),
    modelLimits: { overridden: false, invalid: false },
    modelLimitDraft: {},
    models: { status: 'idle' },
    accounts: { entries: [], activeRef: 'OPENCODE_API_KEY', autoSwitch: true, busy: false, blocked: false, refreshing: false },
    ...overrides,
  }
}

/** One account set with the first entry as the current account. */
export function accountsStateOf(
  entries: readonly GoAccountView[],
  overrides: Partial<GoAccountsState> = {},
): GoAccountsState {
  return {
    entries,
    activeRef: entries[0]?.apiKeyEnv ?? 'OPENCODE_API_KEY',
    autoSwitch: false,
    busy: false,
    blocked: false,
    refreshing: false,
    ...overrides,
  }
}

/** A settled gateway model listing for the Models tab. */
export function modelsOf(entries: readonly GoModel[]): OpencodeGoModels {
  return {
    status: 'ready',
    count: entries.length,
    preview: entries.map(entry => entry.name ?? entry.id),
    entries,
  }
}

/** Every action the page shell must supply, spied but inert by default. */
export function pageActionsOf(overrides: Partial<PageActions> = {}): PageActions {
  return {
    edit: vi.fn(),
    editModelLimits: vi.fn(),
    resetField: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
    loadModels: vi.fn(),
    setEnabled: vi.fn(),
    setModelEnabled: vi.fn(),
    loadAccounts: vi.fn(),
    addAccount: vi.fn(async () => true),
    renameAccount: vi.fn(async () => true),
    removeAccount: vi.fn(async () => true),
    selectAccount: vi.fn(async () => true),
    setAutoSwitch: vi.fn(async () => true),
    replaceAccountKey: vi.fn(async () => true),
    moveAccount: vi.fn(async () => true),
    t: (key, params) => translate(en, key, params),
    getLocale: () => 'en-US',
    ...overrides,
  }
}

/** Interpolate named parameters the way the host translator does. */
export function translate(
  dictionary: Record<string, string>,
  key: string,
  params: Record<string, unknown> = {},
): string {
  const template = dictionary[key] ?? key
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll('{' + name + '}', String(value)), template)
}

/** The official history fixture with a passing reader. */
export function readersOf(overrides: Partial<PageReaders> = {}): PageReaders {
  return {
    readUsage: vi.fn(async () => ({
      rolling: { percent: 0, status: 'ok', resetsAt: '2026-11-13T08:00:00Z' },
      weekly: { percent: 18, status: 'ok', resetsAt: '2026-11-16T00:00:00Z' },
      monthly: { percent: 21, status: 'ok', resetsAt: '2026-12-01T00:00:00Z' },
    })),
    readAccountUsage: vi.fn(async () => ({
      rolling: { percent: 0, status: 'ok', resetsAt: '2026-11-13T08:00:00Z' },
      weekly: { percent: 18, status: 'ok', resetsAt: '2026-11-16T00:00:00Z' },
      monthly: { percent: 21, status: 'ok', resetsAt: '2026-12-01T00:00:00Z' },
    })),
    readAnalytics: vi.fn(async (query: AnalyticsQuery): Promise<AnalyticsReport> => createAnalyticsReport(query)),
    exportAnalytics: vi.fn(async () => ({ filename: 'usage.csv', csv: 'date,requests\n2026-11-05,12\n' })),
    ...overrides,
  }
}

/** Complete props for one sub-page render. */
export function pagePropsOf(overrides: {
  state?: Partial<OpencodeGoSectionState>
  actions?: Partial<PageActions>
  readers?: Partial<PageReaders> | null
  go?: (tab: string) => void
} = {}): PageViewProps {
  const readers = overrides.readers === null ? undefined : readersOf(overrides.readers)
  const actions = pageActionsOf({ ...readers ? { readers } : {}, ...overrides.actions })
  return {
    state: pageStateOf(overrides.state),
    actions,
    locale: 'en-US',
    go: overrides.go ?? (() => {}),
  }
}

/** The flat inject face GoPage takes once the host binds the selector hook. */
export type PageShellFixture = PageShellProps & {
  useOpencodeGo: SnapshotSelectorHook<OpencodeGoSectionState>
  /** The live snapshot store behind the selector, for post-mount state changes. */
  store: SnapshotStore<OpencodeGoSectionState>
}

/**
 * Build the complete GoPage inject face: the same business face a sub-page test
 * uses, plus the hooks.opencodeGo selector hook the host synthesizes.
 */
export function pageShellOf(overrides: {
  state?: Partial<OpencodeGoSectionState>
  actions?: Partial<PageActions>
  readers?: Partial<PageReaders> | null
} = {}): PageShellFixture {
  const view = pagePropsOf(overrides)
  const store = createSnapshotStore(view.state)
  const { t, getLocale, readers, ...seats } = view.actions
  return {
    useOpencodeGo: bindSnapshotSelector(store),
    t,
    getLocale,
    readers,
    ...seats,
    store,
  }
}
