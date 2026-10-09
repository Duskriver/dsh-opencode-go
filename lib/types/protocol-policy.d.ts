import type { Api, Model } from './sdk-types.ts';
import type { OpencodeGoConfig } from './config-contract.ts';
/** Resolve a request's wire model without mutating the shared metadata catalog. */
export declare function withProtocolOverride(model: Model<Api>, config: OpencodeGoConfig): Model<Api>;
