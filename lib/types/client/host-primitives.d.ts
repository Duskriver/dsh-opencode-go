/**
 * Host UI atoms this page reaches for across DSH generations.
 *
 * Icon names moved from pixel size (`IconQuestionOutline14`, DSH 0.1.6 and older) to
 * stroke weight (`IconQuestionOutlineRegular`, 0.1.7 and later), and the old alias is
 * gone in 0.2. A missing atom is not a cosmetic loss here: React throws on an
 * undefined element type, which takes the whole settings surface down with it, so
 * every lookup resolves the current name first and keeps the older one behind it.
 */
/** The atom's component, or undefined when this Host ships neither name. */
export declare function hostAtom<T>(host: Record<string, unknown>, current: string, previous: string): T | undefined;
