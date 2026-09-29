export declare const MODEL_METADATA_MAX_BYTES: number;
export interface CachedMetadata {
    readonly body: unknown;
    readonly etag?: string;
    /** Last successful download or HTTP 304 verification. */
    readonly savedAtMs: number;
}
export declare function metadataCachePath(): string;
/** Only persist validators that can safely become an HTTP request header. */
export declare function metadataETag(value: unknown): string | undefined;
export declare function readMetadataCache(path: string): Promise<CachedMetadata | undefined>;
export declare function writeMetadataCache(path: string, value: CachedMetadata): Promise<void>;
