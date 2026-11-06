// @vitest-environment jsdom
import { describe, afterEach, beforeEach, expect, it, vi } from 'vitest'
import css from '../src/client/UsagePill.module.css'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { GoStatusReport } from '../src/contracts.ts'
import { UsagePill } from '../src/client/UsagePill.tsx'
import { en } from '../src/client/presentation.ts'
import { createConfigForm } from './support/client.tsx'
import type { OpencodeGoSettings } from '../src/client/controller.ts'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'

describe('service status block', () => {
  let settings: ConfigForm<OpencodeGoSettings>

  const report: GoStatusReport = {
    status: 'degraded', updatedAt: Date.UTC(2026, 9, 18, 12), stale: false,
    services: [
      { service: 'console', status: 'operational', reason: 'none' },
      { service: 'go', status: 'degraded', reason: 'upstream', since: Date.UTC(2026, 9, 18, 10),
        breakdown: [
          { id: 'glm-5.3-flash', status: 'operational', reason: 'none', speed: { ttft: 2453, tps: 71 } },
          { id: 'deepseek-v4-pro', status: 'degraded', reason: 'upstream', speed: { ttft: 2827, tps: 125 } },
        ] },
    ],
  }

  const settingsHost = (value: OpencodeGoSettings = {}) => {
    const host = createConfigForm<OpencodeGoSettings>()
    host.publish({ status: 'ready', value })
    return host
  }

  beforeEach(() => { vi.useFakeTimers(); settings = settingsHost().form })

  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

  const t = (key: string) => en[key as keyof typeof en]

  const usage = {
    source: 'account-a',
    rolling: { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' },
    weekly: { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' },
    monthly: { status: 'ok' as const, percent: 10, resetsAt: '2026-09-21T00:00:00Z' },
  }

  const directory = createSnapshotStore<ModelDirectoryState>({
    current: { provider: 'dsh-opencode-go', model: 'deepseek-v4-pro' }, routable: true,
    groups: [], failures: [], status: 'ready', error: null,
  })

  const renderPill = async (readStatus?: () => Promise<GoStatusReport>) => {
    await act(async () => {
      render(<UsagePill settings={settings} directory={directory}
        readUsage={() => Promise.resolve(usage)} readStatus={readStatus} t={t} />)
    })
  }

  const showDetails = () => {
    fireEvent.click(screen.getByRole<HTMLButtonElement>('button', { name: new RegExp(en.usageTitle) }))
  }

  const statusRows = () => [...document.querySelectorAll('.' + css.statusRow)]

  it('shows the Go service health with degraded models first and the current model tagged', async () => {
    const readStatus = vi.fn().mockResolvedValue(report)
    await renderPill(readStatus)
    showDetails()
    expect(screen.getByText(en.statusTitle)).toBeTruthy()
    expect(screen.getByText(new RegExp(en.statusServiceGo))).toBeTruthy()
    expect(screen.getByText(new RegExp(en.statusDegraded))).toBeTruthy()
    expect(screen.getByText(new RegExp(en.statusReasonUpstream))).toBeTruthy()
    // The feed's degraded reading leads even though glm sorts earlier by id.
    const rows = statusRows().map(row => row.textContent ?? '')
    expect(rows.some(row => row.startsWith('deepseek-v4-pro'))).toBe(true)
    expect(rows[0]).toContain('deepseek-v4-pro')
    expect(rows[0]).toContain(en.statusCurrentModel)
    expect(rows[0]).toContain('2.8s · 125 tps')
    expect(rows[1]).toContain('glm-5.3-flash')
    expect(rows[1]).toContain('2.5s · 71 tps')
    expect(screen.queryByText(en.statusStale)).toBeNull()
  })

  it('polls the feed on the status cadence, independent of the usage interval', async () => {
    const readStatus = vi.fn().mockResolvedValue(report)
    await renderPill(readStatus)
    expect(readStatus).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(readStatus).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(4 * 60_000) })
    expect(readStatus).toHaveBeenCalledTimes(2)
  })

  it('marks the block stale on a failed refresh while keeping the last report', async () => {
    const readStatus = vi.fn()
      .mockResolvedValueOnce(report)
      .mockRejectedValue(Object.assign(new Error('status request failed'), {
        code: 'opencode-go/status-unavailable', details: { retryable: true },
      }))
    await renderPill(readStatus)
    showDetails()
    expect(screen.queryByText(en.statusUnavailable)).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000) })
    expect(screen.getByText(en.statusTitle)).toBeTruthy()
    expect(screen.getByText(en.statusStale)).toBeTruthy()
    expect(screen.queryByText(en.statusUnavailable)).toBeNull()
  })

  it('reports an unavailable feed when no report ever arrived', async () => {
    const readStatus = vi.fn().mockRejectedValue(Object.assign(new Error('status request failed'), {
      code: 'opencode-go/status-unavailable', details: { retryable: true },
    }))
    await renderPill(readStatus)
    showDetails()
    expect(screen.getByRole('status').textContent).toBe(en.statusUnavailable)
    expect(screen.queryByText(en.statusTitle)).toBeNull()
  })

  it('omits the block entirely when the session has no status namespace', async () => {
    await renderPill()
    showDetails()
    expect(screen.queryByText(en.statusTitle)).toBeNull()
    expect(document.querySelector('.' + css.status)).toBeNull()
  })
})
