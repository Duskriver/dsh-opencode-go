/** Convert OpenCode's online models.dev metadata into the SDK's three wire protocols. */
import type { Api, Model } from 'opencode-go-pi-ai';
import { type GoModel } from './models-contract.ts';
export declare const MODEL_METADATA_URL = "https://models.dev/api.json";
/** Lifecycle and capability data the online catalog adds to a gateway listing. */
export type ModelDetails = Pick<GoModel, 'deprecated' | 'releaseDate' | 'inputModalities'>;
export interface ModelMetadata {
    readonly models: ReadonlyMap<string, Model<Api>>;
    readonly details: ReadonlyMap<string, ModelDetails>;
    readonly errors: ReadonlyMap<string, string>;
}
/** Anthropic's SDK appends /v1/messages; the OpenAI SDKs append paths below /v1. */
export declare function modelBaseURL(api: Api, baseURL: string): string;
/**
 * Only read the opencode-go record. Online endpoints, headers and credentials
 * are deliberately ignored: model traffic always stays on the configured gateway.
 * A bad entry is isolated instead of discarding every other model.
 */
export declare function readModelMetadata(body: unknown, baseURL: string, builtin: ReadonlyMap<string, Model<Api>>): ModelMetadata;
