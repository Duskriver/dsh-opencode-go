import { OpencodeGoCatalog } from './catalog.ts'
import { assertBaseURL } from './config.ts'
import type { OpencodeGoConfig } from './config-contract.ts'
import { assertProxyURL } from './proxy-url.ts'
import type { ProxyTransport } from './proxy.ts'

/** One mount owns discovery; inference, settings and pickers share its snapshots. */
export class GoCatalogManager {
  private current: { key: string; catalog: OpencodeGoCatalog } | undefined

  constructor(private readonly options: {
    transport: ProxyTransport
    onFallback?: (detail: { url: string; error: unknown; kept: number }) => void
    onOmitted?: (ids: readonly string[]) => void
    onRefresh?: () => void
    onWarning?: (warning: string) => void
  }) {}

  forConfig(config: OpencodeGoConfig): OpencodeGoCatalog {
    const key = JSON.stringify([config.baseURL, config.refreshMinutes, assertProxyURL(config.proxyURL)])
    if (this.current?.key !== key) {
      const catalog = new OpencodeGoCatalog(
        assertBaseURL(config.baseURL), config.refreshMinutes * 60_000,
        this.options.onFallback ?? (() => {}), this.options.onOmitted ?? (() => {}),
        () => {
          if (this.current?.catalog === catalog) this.options.onRefresh?.()
        },
        this.options.transport.forProxy(config.proxyURL), this.options.onWarning,
      )
      this.current = { key, catalog }
    }
    return this.current.catalog
  }
}
