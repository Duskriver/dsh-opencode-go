import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { discoverSettingsModels, type OpencodeGoCatalog } from './catalog.ts'
import type { GoModel } from './models-contract.ts'

/** Uses the same gateway snapshot as the adapter, including models hidden from pickers. */
export class GoModelsService extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: { catalog: () => OpencodeGoCatalog }) {
    super(ctx, 'opencodeGoModels')
  }

  read(): Promise<readonly GoModel[]> {
    return discoverSettingsModels(this.options.catalog())
  }
}
