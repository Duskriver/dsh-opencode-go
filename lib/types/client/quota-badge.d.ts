import { type GoModel, type GoPlan, type PriceMultiplier } from '../contracts.ts';
import { type en } from './presentation.ts';
export type MultiplierTranslate = (key: keyof typeof en, params?: Record<string, unknown>) => string;
export { resolveActiveGoPlan } from '../model-badge.ts';
export type ModelMultiplierBadge = {
    readonly kind: 'free';
    readonly text: string;
    readonly title: string;
    readonly tone: 'free';
} | {
    readonly kind: 'go';
    readonly text: string;
    readonly title: string;
    readonly ariaLabel: string;
    readonly tone: 'normal' | 'peak';
    readonly isPeak: boolean;
};
/**
 * Build the compact list multiplier badge and descriptive tooltip for one model.
 * Returns `undefined` for Free-channel models and models lacking `goMonthlyUsage`
 * or price data, ensuring unreliable fallback numbers are never displayed.
 */
export declare function resolveModelMultiplierBadge(input: {
    model: GoModel;
    plan: GoPlan;
    t: MultiplierTranslate;
    locale?: string;
    nowMs?: number;
}): ModelMultiplierBadge | undefined;
/**
 * Subscribe to a clock that ticks precisely at the next multiplier transition
 * boundary (and optionally the next UTC midnight for 7-day NEW badges) as well
 * as when the document regains visibility.
 */
export declare function useScheduledTransitionClock(schedules: readonly (readonly PriceMultiplier[] | undefined)[], includeUtcMidnight?: boolean): number;
