/**
 * Visual themes for the conversation usage pill and the analytics dashboard.
 * Four palettes share one token vocabulary; each has a dark and a light set so
 * the surfaces follow the Host's color scheme while keeping the selected style.
 *
 * The preference is local to this plugin (localStorage) and never touches the
 * settings document or the Host theme registry.
 *
 * @module dsh-opencode-go/client/theme
 */
import { type CSSProperties } from 'react';
import type { en } from './locales.ts';
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
