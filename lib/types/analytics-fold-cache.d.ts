/**
 * Persistent, revision-keyed cache of folded session analytics.
 *
 * A process restart empties the in-memory LRU in analytics.ts, so a cold scan
 * would re-read every archived session. This module stores the
 * range-independent fold results under the DSH cache directory and lets a later
 * process reuse a session whose durable revision is unchanged. The envelope
 * carries a version and compact arrays; decoding is strict, and any missing,
 * corrupt, oversized or unwritable file behaves exactly like an empty cache.
 * Session ids are only cache keys — no titles, message text or credentials are
 * ever stored.
 *
 * @module dsh-opencode-go/analytics-fold-cache
 */
import type { RequestFact } from './analytics-scan.ts';
/** Envelope version; a different version is treated as no cache. */
export declare const ANALYTICS_FOLD_CACHE_VERSION = 1;
/** The whole encoded document may not exceed this size. */
export declare const ANALYTICS_FOLD_CACHE_MAX_BYTES: number;
/** An entry not refreshed for this long may be dropped at the next write. */
export declare const ANALYTICS_FOLD_CACHE_MAX_AGE_MS: number;
/** One session's fold plus the revision it was computed from. */
export interface AnalyticsFoldEntry {
    /** The durable revision of the session this fold was read from. */
    readonly revision: string;
    /** When the fold was computed; drives age and capacity eviction. */
    readonly storedAt: number;
    readonly createdAt: number;
    /** Events that passed the fork-prefix filter when the fold ran. */
    readonly events: number;
    readonly facts: RequestFact[];
    readonly attempts: number[];
    readonly unattributed: number[];
}
/** Path options; tests point the cache at a temporary home. */
export interface AnalyticsFoldCachePathOptions {
    /** DSH home directory; defaults to $DSH_HOME, then ~/.dsh. */
    readonly home?: string;
}
/** The default cache location, honoring DSH_HOME and the test override. */
export declare function analyticsFoldCachePath(options?: AnalyticsFoldCachePathOptions): string;
/**
 * Encode entries into the versioned envelope. Facts are compact tuples whose
 * exact field count is checked again on decode.
 * @param entries - cache key to fold entry pairs.
 * @returns the JSON document.
 */
export declare function encodeFoldCache(entries: Iterable<readonly [string, AnalyticsFoldEntry]>): string;
/**
 * Decode the versioned envelope. Every field is validated before it reaches
 * the scan: a single malformed session discards the whole document, so a
 * damaged file degrades to "no cache" instead of a partially trusted one.
 * @param text - the JSON document.
 * @returns the decoded map, or undefined when anything is invalid.
 */
export declare function decodeFoldCache(text: string): Map<string, AnalyticsFoldEntry> | undefined;
/** Optional byte cap for load/save; tests use a small cap. */
export interface AnalyticsFoldCacheLimits {
    readonly maxBytes?: number;
}
/**
 * Load the cache. Any failure — absent file, unreadable path, oversized file,
 * invalid JSON or invalid fields — resolves to an empty map.
 * @param path - cache file path.
 * @param options - byte-cap override.
 * @returns the entries that passed validation.
 */
export declare function loadFoldCache(path: string, options?: AnalyticsFoldCacheLimits): Promise<Map<string, AnalyticsFoldEntry>>;
/**
 * Atomically write the cache, dropping the oldest entries by storedAt until
 * the encoded document fits the byte cap. A failed write returns false and
 * leaves any previous valid file in place.
 * @param path - cache file path.
 * @param entries - key/value pairs to persist.
 * @param options - byte-cap override.
 * @returns whether the file was replaced.
 */
export declare function saveFoldCache(path: string, entries: Iterable<readonly [string, AnalyticsFoldEntry]>, options?: AnalyticsFoldCacheLimits): Promise<boolean>;
