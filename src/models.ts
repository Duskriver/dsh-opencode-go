import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { discoverSettingsModels, type OpencodeGoCatalog } from './catalog.ts'
import type { GoModelCatalog } from './models-contract.ts'

/** Uses the same gateway snapshot as the adapter, including models hidden from pickers. */
export class GoModelsService extends TypertRemoteService {
  constructor(ctx: Context, private readonly options: {
    catalog: () => OpencodeGoCatalog
    onRefresh?: () => void
  }) {
    super(ctx, 'opencodeGoModels')
  }

  async read(): Promise<GoModelCatalog> {
    try {
      return await discoverSettingsModels(this.options.catalog())
    } finally {
      // Settings and pickers consume the same freshly committed or retained snapshot.
      this.options.onRefresh?.()
    }
  }
}
