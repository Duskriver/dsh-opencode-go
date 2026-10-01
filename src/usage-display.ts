/** Usage visibility shared by the Host schema and the browser settings. */
export const USAGE_DISPLAY_MODES = ['auto', 'always', 'off'] as const
export type UsageDisplayMode = typeof USAGE_DISPLAY_MODES[number]
export const DEFAULT_USAGE_DISPLAY: UsageDisplayMode = 'auto'
