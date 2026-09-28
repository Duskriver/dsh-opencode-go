/** Settings discovery includes lifecycle data that the host's generic model DTO omits. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
export interface GoModel {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    deprecated?: boolean;
    releaseDate?: string;
    /** Advertised by the gateway but lacking a usable protocol and capability configuration. */
    configurationMissing?: boolean;
}
/** Last successful check of one catalog source, plus any current refresh failure. */
export interface GoCatalogSourceStatus {
    readonly updatedAt?: number;
    readonly error?: string;
}
/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
export interface GoModelCatalog {
    readonly models: readonly GoModel[];
    readonly stale: boolean;
    readonly error?: string;
    /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
    readonly sources?: {
        readonly listing: GoCatalogSourceStatus;
        readonly metadata: GoCatalogSourceStatus;
    };
}
/** Missing configuration cannot be enabled; configured models follow explicit switches or lifecycle defaults. */
export declare function isModelEnabled(model: Pick<GoModel, 'id' | 'deprecated' | 'configurationMissing'>, modelVisibility?: Readonly<Record<string, boolean>>): boolean;
export declare function validReleaseDate(value: unknown): value is string;
/** Calendar dates are supplied without a timezone; compare UTC dates consistently. */
export declare function isNewModel(model: GoModel, now?: number): boolean;
export declare function sortModels(models: readonly GoModel[], now?: number): GoModel[];
export declare function parseGoModels(value: unknown): GoModel[];
export declare function parseGoModelCatalog(value: unknown): GoModelCatalog;
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoModels: {
            read(): Promise<RemoteResult<GoModelCatalog>>;
        };
    }
}
export declare const modelsRemote: TypertRemoteContribution;
