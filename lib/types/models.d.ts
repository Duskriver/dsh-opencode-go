import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { type OpencodeGoCatalog } from './catalog.ts';
import type { GoModelCatalog } from './models-contract.ts';
/** Uses the same gateway snapshot as the adapter, including models hidden from pickers. */
export declare class GoModelsService extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        catalog: () => OpencodeGoCatalog;
        onRefresh?: () => void;
    });
    read(): Promise<GoModelCatalog>;
}
