/** English and Chinese copy, palette tokens and local theme preferences. */
import { type CSSProperties } from 'react';
/** Copy dictionaries for the OpenCode Go settings page. English is the key-set source of truth. */
export declare const en: {
    accountsTitle: string;
    accountsRefresh: string;
    accountsBlocked: string;
    accountsEmpty: string;
    accountsWriteFailed: string;
    accountsReadFailed: string;
    accountsCleanupFailed: string;
    accountsRemoveKeyFailed: string;
    accountsStatusUnknown: string;
    accountDefault: string;
    accountAdd: string;
    accountRename: string;
    accountReplaceKey: string;
    accountRemove: string;
    accountRemoveHint: string;
    accountName: string;
    accountKeyHint: string;
    accountConfirm: string;
    accountCancel: string;
    accountAutoSwitch: string;
    accountAutoSwitchHint: string;
    accountPreferredTag: string;
    accountSwitchAction: string;
    accountSwitchTitle: string;
    accountSwitchBack: string;
    accountSwitchHint: string;
    accountSwitchFailed: string;
    accountFallbackQuota: string;
    accountFallbackCredential: string;
    accountsSummary: string;
    accountsSummaryEmpty: string;
    accountsAvailability: string;
    accountsAvailabilityFailed: string;
    accountsDetails: string;
    accountsDetailsHide: string;
    accountDragHandle: string;
    accountConfigureHint: string;
    usageResetMinutes: string;
    usageResetHours: string;
    usageResetDays: string;
    usageResetDue: string;
    usageResetUnknown: string;
    usageTitle: string;
    usageRollingShort: string;
    usageWeekShort: string;
    usage_rolling: string;
    usage_weekly: string;
    usage_monthly: string;
    usageResets: string;
    usageLimited: string;
    usageLoading: string;
    usageUnavailable: string;
    usageStaleShort: string;
    usageFallbackShort: string;
    usageStaleHint: string;
    usageRefreshFailed: string;
    usageLastUpdated: string;
    usageRetry: string;
    usageRefreshing: string;
    analyticsOpen: string;
    analyticsTitle: string;
    analyticsSubtitle: string;
    analyticsClose: string;
    analyticsRange: string;
    analyticsRangeToday: string;
    analyticsRange7d: string;
    analyticsRange30d: string;
    analyticsRange90d: string;
    analyticsRefresh: string;
    analyticsRetry: string;
    analyticsLoading: string;
    analyticsEmpty: string;
    analyticsUnsupported: string;
    analyticsFailed: string;
    analyticsRequests: string;
    analyticsTokens: string;
    analyticsSpend: string;
    analyticsCoverage: string;
    analyticsSessions: string;
    analyticsSeconds: string;
    analyticsSummaries: string;
    analyticsUnsettled: string;
    analyticsByModel: string;
    analyticsByDay: string;
    analyticsInput: string;
    analyticsOutput: string;
    analyticsCacheRead: string;
    analyticsPriced: string;
    analyticsUnpriced: string;
    analyticsMissing: string;
    analyticsFailedSessions: string;
    analyticsUnattributed: string;
    analyticsUnread: string;
    analyticsScanSegments: string;
    analyticsStaleResults: string;
    analyticsTruncated: string;
    analyticsScanMore: string;
    analyticsPriceSource: string;
    analyticsNotInvoice: string;
    analyticsPricingUnavailable: string;
    analyticsLegacy: string;
    analyticsCardTitle: string;
    analyticsCardHint: string;
    analyticsBoardLabel: string;
    analyticsOpenBoard: string;
    analyticsQuota: string;
    analyticsQuotaHint: string;
    analyticsQuotaFailed: string;
    analyticsChartSpend: string;
    analyticsChartTokens: string;
    analyticsKicker: string;
    analyticsLead: string;
    analyticsLeadTop: string;
    analyticsComposition: string;
    analyticsCompositionHint: string;
    analyticsCompositionOther: string;
    analyticsCompositionFree: string;
    analyticsModel: string;
    analyticsCost: string;
    analyticsShare: string;
    analyticsCacheHit: string;
    analyticsDailyAverage: string;
    analyticsPeak: string;
    analyticsTotal: string;
    themeLabel: string;
    themeSilentBlack: string;
    themeGraphite: string;
    themeSeaSalt: string;
    themeWarmSand: string;
    themeHint: string;
    nav: string;
    title: string;
    titleLabel: string;
    intro: string;
    starProject: string;
    starProjectTitle: string;
    enabledLabel: string;
    enabledHint: string;
    enabledOff: string;
    enabledUnavailable: string;
    keyLabel: string;
    keyHint: string;
    keyConfigured: string;
    keyMissing: string;
    keyNotWritable: string;
    modelsLabel: string;
    modelSourcesLabel: string;
    modelsGoTab: string;
    modelsFreeTab: string;
    modelsGoSource: string;
    modelsFreeSource: string;
    modelsRefresh: string;
    modelsLoading: string;
    modelsFailed: string;
    modelsStale: string;
    modelsSourceFailed: string;
    modelsSourceCurrent: string;
    modelsSourceNeverFetched: string;
    modelsSourceUpdated: string;
    modelsRefreshing: string;
    modelsEmpty: string;
    limitsLabel: string;
    limitsHint: string;
    limitsFilterLabel: string;
    limitsFilterPlaceholder: string;
    limitsSummary: string;
    limitsModel: string;
    limitsContext: string;
    limitsOutput: string;
    thinkingBudgets: string;
    thinkingBudgetsHint: string;
    thinkingBudgetAddLabel: string;
    thinkingBudgetAdd: string;
    thinkingBudgetRemove: string;
    capacityDefault: string;
    capacityMissing: string;
    modalityLabel: string;
    modalityText: string;
    modalityImage: string;
    modalityAudio: string;
    modalityVideo: string;
    modalityPdf: string;
    modalityUnknown: string;
    modalitiesSource: string;
    modalitiesForwarding: string;
    visibilityHint: string;
    modelVisibleLabel: string;
    configurationMissing: string;
    configurationMissingHint: string;
    configurationUnavailable: string;
    pickerFailed: string;
    deprecatedBadge: string;
    deprecatedHint: string;
    newHint: string;
    newBadge: string;
    releaseSource: string;
    modelDetails: string;
    filterLabel: string;
    filterAll: string;
    filterNew: string;
    filterCustom: string;
    filterDeprecated: string;
    limitsResetModel: string;
    limitsResetAll: string;
    limitsNoMatches: string;
    limitsEmpty: string;
    limitsContextLabel: string;
    limitsOutputLabel: string;
    advancedResetAll: string;
    advancedLabel: string;
    groupUsage: string;
    groupConnection: string;
    groupCacheTimeouts: string;
    groupImages: string;
    advancedHint: string;
    usageDisplayLabel: string;
    usageDisplayHint: string;
    usageDisplay_auto: string;
    usageDisplay_always: string;
    usageDisplay_off: string;
    freeBaseURLLabel: string;
    freeBaseURLHint: string;
    baseURLLabel: string;
    baseURLHint: string;
    proxyURLLabel: string;
    proxyURLHint: string;
    proxyURLInvalid: string;
    refreshMinutesLabel: string;
    refreshMinutesHint: string;
    streamIdleTimeoutMsLabel: string;
    streamIdleTimeoutMsHint: string;
    maxImagesLabel: string;
    maxImagesHint: string;
    maxRequestImageBytesLabel: string;
    maxRequestImageBytesHint: string;
    requestImagePixelBudgetLabel: string;
    requestImagePixelBudgetHint: string;
    requestImageMaxBytesLabel: string;
    requestImageMaxBytesHint: string;
    overridden: string;
    reset: string;
    invalidValue: string;
    save: string;
    discard: string;
    saving: string;
    savedFailed: string;
    readOnly: string;
    unavailable: string;
};
/** Chinese copy; the key set mirrors {@link en}. */
export declare const zh: typeof en;
/** Every copy key this page's dictionaries must supply. */
export type OpencodeGoKey = keyof typeof en;
/** One palette's six theme colors plus the neutral surface steps. */
export interface GoThemeTokens {
    readonly bg: string;
    readonly surface: string;
    readonly surface2: string;
    readonly border: string;
    readonly text: string;
    readonly muted: string;
    readonly accent: string;
    readonly accent2: string;
    readonly success: string;
    readonly warning: string;
    readonly danger: string;
}
/** The four selectable styles. */
export declare const GO_THEMES: readonly ["silent-black", "graphite", "sea-salt", "warm-sand"];
export type GoThemeId = typeof GO_THEMES[number];
/** Graphite is the default: it is the quietest match for the Host chrome. */
export declare const DEFAULT_GO_THEME: GoThemeId;
/** Locale key carrying each theme's display name. */
export declare const GO_THEME_LABELS: Record<GoThemeId, keyof typeof en>;
/** Each style in both Host color schemes. */
export declare const GO_THEME_TOKENS: Record<GoThemeId, {
    dark: GoThemeTokens;
    light: GoThemeTokens;
}>;
/** The selected style, stable until the next write. */
export declare function getGoTheme(): GoThemeId;
/**
 * Select a style and persist it for this browser.
 * @param id - one of {@link GO_THEMES}; unknown ids are ignored.
 */
export declare function setGoTheme(id: GoThemeId): void;
/** Subscribe to style changes (for useSyncExternalStore). */
export declare function subscribeGoTheme(listener: () => void): () => void;
/** Read the selected style in a component. */
export declare function useGoTheme(): GoThemeId;
/**
 * Follow the Host's light/dark scheme. The layout presenter marks a dark body
 * with `data-ds-dark-theme`; the attribute is observed so switching the Host
 * theme updates the surfaces without a reload.
 */
export declare function useHostScheme(): 'dark' | 'light';
/** The active style's tokens for the Host's current scheme. */
export declare function useGoThemeTokens(): GoThemeTokens;
/**
 * Inline custom properties consumed by the pill and dialog styles.
 * @param tokens - the active palette.
 * @returns a style object carrying every `--go-*` variable.
 */
export declare function themeStyle(tokens: GoThemeTokens): CSSProperties;
