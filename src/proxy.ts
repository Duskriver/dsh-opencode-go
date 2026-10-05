import { ProxyAgent, Socks5ProxyAgent } from 'undici'
import type { Dispatcher } from 'undici'
import { assertProxyURL } from './proxy-url.ts'

/** Per-mount transport. Fetch closures retain their address across settings changes. */
export class ProxyTransport {
  private current: { address: string; dispatcher: Dispatcher } | undefined
  private readonly retired = new Set<Dispatcher>()
  private disposed = false

  forProxy(raw?: string): typeof globalThis.fetch | undefined {
    const address = assertProxyURL(raw)
    if (!address) { this.retire(); return undefined }
    return (input, init) => {
      if (this.disposed) return Promise.reject(new Error('OpenCode Go proxy transport is disposed'))
      if (this.current?.address !== address) {
        const url = new URL(address)
        const dispatcher = url.protocol === 'socks5:' ? new Socks5ProxyAgent(url) : new ProxyAgent(address)
        this.retire()
        this.current = { address, dispatcher }
      }
      const options: RequestInit & { dispatcher: Dispatcher } = { ...init, dispatcher: this.current.dispatcher }
      return globalThis.fetch(input, options)
    }
  }

  /** Close replaced pools after their in-flight response bodies have finished. */
  private retire(): void {
    if (!this.current) return
    const { dispatcher } = this.current
    this.current = undefined
    this.retired.add(dispatcher)
    void dispatcher.close().catch(() => dispatcher.destroy()).catch(() => {})
      .finally(() => { this.retired.delete(dispatcher) })
  }

  /** Unloading the mount cancels remaining requests and releases every pool. */
  async dispose(): Promise<void> {
    this.disposed = true
    const dispatchers = [...this.retired, ...(this.current ? [this.current.dispatcher] : [])]
    this.current = undefined
    this.retired.clear()
    await Promise.all(dispatchers.map(dispatcher => dispatcher.destroy().catch(() => {})))
  }
}
