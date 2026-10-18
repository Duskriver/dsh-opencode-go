/** Convert OpenCode's online models.dev metadata into the supported SDK wire protocols. */
import type { Api, Model } from './sdk-types.ts';
import { type GoModel } from './models-contract.ts';
export declare const MODEL_METADATA_URL = "https://models.dev/api.json";
/** Lifecycle and capability data the online catalog adds to a gateway listing. */
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'> & {
    /**
     * Present only when the upstream cost block is missing or carries a malformed
     * component: its zeros are then indistinguishable from a genuinely free model,
     * so analytics must treat the model as unpriced instead of pricing it at 0.
     * A published block with legal components stays unmarked even when all zero.
     */
    readonly costKnown?: false;
};
export interface ModelMetadata {
    readonly models: ReadonlyMap<string, Model<Api>>;
    readonly details: ReadonlyMap<string, ModelDetails>;
    readonly errors: ReadonlyMap<string, string>;
}
/** Select documented official protocol endpoints while preserving custom gateway prefixes. */
export declare function modelBaseURL(api: Api, baseURL: string): string;
/** Shared Responses defaults for declared models and explicit protocol overrides. */
export declare function responsesCompatibility(): NonNullable<Model<'openai-responses'>['compat']>;
/**
 * Only read the opencode-go record. Online endpoints, headers and credentials
 * are deliberately ignored: protocol endpoints are selected on the configured gateway.
 * A bad entry is isolated instead of discarding every other model.
 */
export declare function readModelMetadata(body: unknown, baseURL: string, builtin: ReadonlyMap<string, Model<Api>>): ModelMetadata;
