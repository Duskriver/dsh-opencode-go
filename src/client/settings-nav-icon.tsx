/**
 * The OpenCode Go glyph in the settings dialog's navigation.
 *
 * DSH 0.2.2 added a real icon seat — `settings.section.icon`, a root list whose
 * entries are addressed by the section id and painted as that row's glyph. Hosts
 * before it pick nav glyphs from a closed list of section ids and fall back to
 * the gear for every other id; on those the row can only be claimed in the DOM.
 *
 * This module prefers the seat and falls back to the DOM stand-in only while the
 * host has not declared it. The stand-in follows the shape other plugins proved
 * out: mark the row whose visible text equals this plugin's own localized
 * section label, hide the shell's gear, and paint the mark through a CSS mask so
 * the host's idle/selected colour still drives it. No shell structure is touched;
 * the marker and the stylesheet belong to the fiber; a host that changes its DOM
 * while never declaring the seat simply keeps its gear.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { GoRowIcon, goRowMaskSvg } from './GoMark.tsx'
import { SETTINGS_SECTION_ICON_SLOT, SETTINGS_SECTION_ID } from './host-slots.ts'

/** Marks the one settings-navigation row this plugin owns. */
export const SETTINGS_NAV_MARKER = 'data-opencode-go-nav-icon'

/**
 * The settings dialog's section rows: the shell renders each `settings.section`
 * entry as a `<button>` inside the panel's `<nav>` (SettingsPanel in
 * dsh-client-ui-settings-general).
 */
export const SETTINGS_NAV_ROW_SELECTOR = '[role="dialog"] nav button'

/**
 * Whether one nav row is this plugin's own row.
 *
 * The shell projects only the registrant's label, so the visible text is the one
 * identity a registrant can match. An empty label matches nothing: a locale that
 * has not resolved yet must not claim rows.
 * @param rowText - the row's current visible text.
 * @param wantedLabel - this plugin's current section label.
 * @returns whether the row belongs to this plugin.
 */
export function isOwnSettingsNavRow(rowText: string | null | undefined, wantedLabel: string): boolean {
  const wanted = String(wantedLabel ?? '').trim()
  if (wanted.length === 0) return false
  return String(rowText ?? '').trim() === wanted
}

/**
 * The glyph as a CSS `mask-image` URL. Masks read alpha only, so the standalone
 * SVG is painted black; the marked row supplies the visible colour.
 * @param svg - standalone SVG source; defaults to the row mark.
 * @returns an encoded `data:image/svg+xml` URL.
 */
export function settingsNavMaskUrl(svg: string = goRowMaskSvg()): string {
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/**
 * Stylesheet for the marked row: hide the shell's glyph and draw ours.
 * Hiding both the direct `<svg>` and the host's `navIcon` wrapper covers the
 * shells this plugin supports, where the gear is either an inline SVG child or a
 * class-wrapped element.
 * @param maskUrl - encoded mask URL from {@link settingsNavMaskUrl}.
 * @returns the CSS text.
 */
export function settingsNavIconCss(maskUrl: string): string {
  const hide = '[' + SETTINGS_NAV_MARKER + '] > svg, [' + SETTINGS_NAV_MARKER + '] [class*="navIcon"] { display: none; }'
  const before = [
    '[' + SETTINGS_NAV_MARKER + ']::before {',
    '  content: \'\';',
    '  flex: none;',
    '  width: 16px;',
    '  height: 16px;',
    '  background-color: currentColor;',
    '  -webkit-mask-image: url("' + maskUrl + '");',
    '  mask-image: url("' + maskUrl + '");',
    '  -webkit-mask-repeat: no-repeat;',
    '  mask-repeat: no-repeat;',
    '  -webkit-mask-position: center;',
    '  mask-position: center;',
    '  -webkit-mask-size: 16px 16px;',
    '  mask-size: 16px 16px;',
    '}',
  ].join('\n')
  return hide + '\n' + before
}

/**
 * Claim the settings nav row on hosts that never declare the icon seat.
 *
 * The marker and the injected stylesheet are removed by the returned cleanup.
 * @param resolveLabel - this plugin's current section label, re-read on every
 * sync so a locale switch is picked up without re-registering.
 * @returns a cleanup that removes the marker, the stylesheet and the observer.
 */
export function startSettingsNavStandIn(resolveLabel: () => string): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || document.body === null) return () => {}
  const doc = document
  const style = doc.createElement('style')
  style.dataset.plugin = 'dsh-opencode-go'
  style.dataset.pluginCss = 'dsh-opencode-go/settings-nav-icon'
  style.textContent = settingsNavIconCss(settingsNavMaskUrl())
  doc.head.appendChild(style)
  let disposed = false
  let scheduled = false
  const sync = (): void => {
    scheduled = false
    if (disposed) return
    const wanted = resolveLabel()
    for (const row of doc.querySelectorAll<HTMLElement>(SETTINGS_NAV_ROW_SELECTOR)) {
      if (isOwnSettingsNavRow(row.textContent, wanted)) row.setAttribute(SETTINGS_NAV_MARKER, '')
      else row.removeAttribute(SETTINGS_NAV_MARKER)
    }
  }
  /** Coalesce observer bursts into one pass; the shell rewrites the nav often. */
  const schedule = (): void => {
    if (scheduled || disposed) return
    scheduled = true
    queueMicrotask(sync)
  }
  sync()
  const observer = new MutationObserver(schedule)
  observer.observe(doc.body, { childList: true, subtree: true, characterData: true })
  return () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    for (const row of doc.querySelectorAll<HTMLElement>('[' + SETTINGS_NAV_MARKER + ']')) row.removeAttribute(SETTINGS_NAV_MARKER)
    style.remove()
  }
}

/**
 * Mount the settings-navigation glyph: the host icon seat when it exists, the
 * DOM stand-in until then (and never after the seat appears).
 * @param ctx - client root context; owns both effects.
 * @param resolveLabel - this plugin's current section label.
 */
export function installSettingsNavIcon(ctx: ClientContext, resolveLabel: () => string): void {
  let stopStandIn: (() => void) | undefined
  let hostPaints = false
  ctx.effect(() => ctx.slots.inject(SETTINGS_SECTION_ICON_SLOT, () => {
    hostPaints = true
    stopStandIn?.()
    stopStandIn = undefined
    const dispose = ctx.slots.register({
      name: SETTINGS_SECTION_ICON_SLOT,
      id: SETTINGS_SECTION_ID,
    }, (owner: { size?: number } = {}) => <GoRowIcon size={owner.size ?? 16} />)
    return typeof dispose === 'function' ? dispose : () => {}
  }), 'llm-opencode-go: settings nav icon seat')
  // A host that already declared the seat got its registration above; only the
  // older shells need the stand-in, and the seat's arrival stops it.
  if (!hostPaints) stopStandIn = startSettingsNavStandIn(resolveLabel)
  ctx.effect(() => () => {
    stopStandIn?.()
    stopStandIn = undefined
  }, 'llm-opencode-go: settings nav icon stand-in')
}
