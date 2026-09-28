/**
 * Dedicated OpenCode Go adapter plugin. Registers one `opencode-go` route
 * whose catalog follows the gateway's live model listing and models.dev
 * metadata, and installs the `llm-opencode-go` settings section: the Web UI
 * renders it as its own settings page where the API key and every knob are
 * edited, and a change reaches the next request without a restart. The plugin
 * exists because the gateway has wire requirements a generic pi-ai route
 * cannot express: a mandatory per-conversation `x-opencode-session` routing
 * header and a model list that rotates faster than any shipped catalog.
 *
 * DSH 0.1.5/0.1.6 layer the settings document over the composition entry;
 * 0.1.7 edits live configuration fields on the profile entry directly.
 *
 * ```yaml
 * - id: llm-opencode-go
 *   name: 'dsh-opencode-go'
 *   config:
 *     enabled: true                     # false withdraws the route; the plugin stays mounted
 *     apiKeyEnv: OPENCODE_API_KEY       # default
 *     baseURL: https://opencode.ai/zen/go/v1   # default
 *     refreshMinutes: 60                # live catalog re-resolution interval
 * ```
 *
 * The credential resolves per request through the credentials seam, falling
 * back to the process environment — the same reference semantics the generic
 * pi-ai adapter uses. The route registers atomically: if another adapter
 * family already owns `opencode-go` (a profile in `llm-pi-ai`, for example),
 * the refusal is logged with the reason and everything else this plugin does
 * still works.
 *
 * @module dsh-opencode-go
 */
import type { Context } from '@deepseek-ai/cordis';
import type { LiveConfig, OpencodeGoConfig } from './config.ts';
declare module '@deepseek-ai/cordis' {
    interface Events {
        'loader/volatile-update'(paths: readonly (readonly string[])[]): void;
    }
}
export { OpencodeGoAdapter } from './adapter.ts';
export type { OpencodeGoAdapterOptions, OpencodeGoImageAccess } from './adapter.ts';
export { DEFAULT_BASE_URL, DISPLAY_NAME, PROVIDER_ID, OpencodeGoCatalog, discoverCatalogModels, readLiveModelIds, } from './catalog.ts';
export { Config, PlainConfig, assertBaseURL } from './config.ts';
export type { OpencodeGoConfig } from './config.ts';
export declare const name = "llm-opencode-go";
export declare const inject: string[];
/** Settings namespace this plugin installs and the Web page edits. */
export declare const NS = "llm-opencode-go";
/**
 * Register the route, its discovery, the settings section, and their
 * teardown for one mount. Configuration starts as the cordis.yml entry and is
 * replaced by the settings section's resolved value once the settings
 * provider attaches; the adapter re-reads it at every operation.
 */
export declare function apply(ctx: Context, raw?: OpencodeGoConfig | LiveConfig): void;
