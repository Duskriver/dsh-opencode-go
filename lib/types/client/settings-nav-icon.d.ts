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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
/** Marks the one settings-navigation row this plugin owns. */
export declare const SETTINGS_NAV_MARKER = "data-opencode-go-nav-icon";
/**
 * The settings dialog's section rows: the shell renders each `settings.section`
 * entry as a `<button>` inside the panel's `<nav>` (SettingsPanel in
 * dsh-client-ui-settings-general).
 */
export declare const SETTINGS_NAV_ROW_SELECTOR = "[role=\"dialog\"] nav button";
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
export declare function isOwnSettingsNavRow(rowText: string | null | undefined, wantedLabel: string): boolean;
/**
 * The glyph as a CSS `mask-image` URL. Masks read alpha only, so the standalone
 * SVG is painted black; the marked row supplies the visible colour.
 * @param svg - standalone SVG source; defaults to the row mark.
 * @returns an encoded `data:image/svg+xml` URL.
 */
export declare function settingsNavMaskUrl(svg?: string): string;
/**
 * Stylesheet for the marked row: hide the shell's glyph and draw ours.
 * Hiding both the direct `<svg>` and the host's `navIcon` wrapper covers the
 * shells this plugin supports, where the gear is either an inline SVG child or a
 * class-wrapped element.
 * @param maskUrl - encoded mask URL from {@link settingsNavMaskUrl}.
 * @returns the CSS text.
 */
export declare function settingsNavIconCss(maskUrl: string): string;
/**
 * Claim the settings nav row on hosts that never declare the icon seat.
 *
 * The marker and the injected stylesheet are removed by the returned cleanup.
 * @param resolveLabel - this plugin's current section label, re-read on every
 * sync so a locale switch is picked up without re-registering.
 * @returns a cleanup that removes the marker, the stylesheet and the observer.
 */
export declare function startSettingsNavStandIn(resolveLabel: () => string): () => void;
/**
 * Mount the settings-navigation glyph: the host icon seat when it exists, the
 * DOM stand-in until then (and never after the seat appears).
 * @param ctx - client root context; owns both effects.
 * @param resolveLabel - this plugin's current section label.
 */
export declare function installSettingsNavIcon(ctx: ClientContext, resolveLabel: () => string): void;
