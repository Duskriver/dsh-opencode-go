import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  ANALYTICS_FOLD_CACHE_VERSION,
  analyticsFoldCachePath,
  decodeFoldCache,
  encodeFoldCache,
  loadFoldCache,
  saveFoldCache,
  type AnalyticsFoldEntry,
} from '../src/analytics-fold-cache.ts'
import type { RequestFact } from '../src/analytics-scan.ts'

const AT = Date.UTC(2026, 9, 19)

const fact = (overrides: Partial<RequestFact> = {}): RequestFact => ({
  at: AT, model: 'deepseek-v4.1-flash', input: 10, output: 20, cacheRead: 30, cacheWrite: 40,
  legacy: false, kind: 'message', missingUsage: false, ...overrides,
})

const entry = (overrides: Partial<AnalyticsFoldEntry> = {}): AnalyticsFoldEntry => ({
  revision: 'rev-1', storedAt: AT, createdAt: AT - 1000, events: 3,
  facts: [fact()], attempts: [AT], unattributed: [AT + 1], ...overrides,
})

let root: string
let path: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'opencode-go-analytics-folds-'))
  path = join(root, 'analytics-folds.v1.json')
})

afterEach(async () => { await rm(root, { recursive: true, force: true }) })

/** Parse the encoder's own output so every corrupt case starts from valid data. */
function documentWith(mutate: (document: { version?: unknown; sessions: unknown[] }) => void): string {
  const document = JSON.parse(encodeFoldCache([['session-a', entry()]])) as {
    version?: unknown
    sessions: unknown[]
  }
  mutate(document)
  return JSON.stringify(document)
}

function sessionDocument(mutate: (session: unknown[]) => void): string {
  return documentWith(document => { mutate(document.sessions[0] as unknown[]) })
}

function factDocument(mutate: (fact: unknown[]) => void): string {
  return sessionDocument(session => { mutate((session[5] as unknown[][])[0]) })
}

it('resolves the default path under DSH_HOME and honors the home override', () => {
  const home = process.env.DSH_HOME!
  expect(analyticsFoldCachePath()).toBe(resolve(home, 'cache', 'dsh-opencode-go', 'analytics-folds.v1.json'))
  expect(analyticsFoldCachePath({ home: join(root, 'alt') }))
    .toBe(resolve(root, 'alt', 'cache', 'dsh-opencode-go', 'analytics-folds.v1.json'))
})

it('round-trips facts, flag bits, marks and counters through the compact encoding', () => {
  const entries = new Map<string, AnalyticsFoldEntry>([
    ['session-a', entry({
      facts: [
        fact(),
        fact({ at: AT + 1, legacy: true }),
        fact({ at: AT + 2, kind: 'summary', missingUsage: true }),
        fact({ at: AT + 3, legacy: true, kind: 'summary', missingUsage: true }),
      ],
    })],
    ['session-b', entry({
      revision: 'rev-2', storedAt: AT + 9, createdAt: 0, events: 0,
      facts: [], attempts: [], unattributed: [],
    })],
  ])
  const text = encodeFoldCache(entries)
  const document = JSON.parse(text) as { version: number; sessions: unknown[][] }
  expect(document.version).toBe(ANALYTICS_FOLD_CACHE_VERSION)
  expect(document.sessions[0]).toHaveLength(8)
  expect(document.sessions[0][5]).toHaveLength(4)
  expect((document.sessions[0][5] as unknown[][])[0]).toHaveLength(7)
  expect(decodeFoldCache(text)).toEqual(entries)
})

it('accepts an empty session list', () => {
  const decoded = decodeFoldCache(JSON.stringify({ version: ANALYTICS_FOLD_CACHE_VERSION, sessions: [] }))
  expect(decoded?.size).toBe(0)
})

const malformed: { name: string; text: string }[] = [
  { name: 'invalid JSON', text: '{' },
  { name: 'non-object root', text: 'null' },
  { name: 'missing version', text: JSON.stringify({ sessions: [] }) },
  { name: 'unknown version', text: documentWith(document => { document.version = 2 }) },
  { name: 'sessions not an array', text: documentWith(document => { document.sessions = {} as unknown[] }) },
  { name: 'entry not an array', text: documentWith(document => { document.sessions = [null] }) },
  { name: 'short session tuple', text: sessionDocument(session => { session.splice(7, 1) }) },
  { name: 'empty id', text: sessionDocument(session => { session[0] = '' }) },
  { name: 'overlong id', text: sessionDocument(session => { session[0] = 'x'.repeat(600) }) },
  { name: 'empty revision', text: sessionDocument(session => { session[1] = '' }) },
  { name: 'overlong revision', text: sessionDocument(session => { session[1] = 'r'.repeat(600) }) },
  { name: 'negative storedAt', text: sessionDocument(session => { session[2] = -1 }) },
  { name: 'fractional createdAt', text: sessionDocument(session => { session[3] = 1.5 }) },
  { name: 'unsafe events', text: sessionDocument(session => { session[4] = 2 ** 53 }) },
  { name: 'facts not an array', text: sessionDocument(session => { session[5] = {} }) },
  { name: 'fact not an array', text: sessionDocument(session => { session[5] = [null] }) },
  { name: 'short fact tuple', text: factDocument(value => { value.splice(6, 1) }) },
  { name: 'negative fact time', text: factDocument(value => { value[0] = -1 }) },
  { name: 'empty model', text: factDocument(value => { value[1] = '' }) },
  { name: 'overlong model', text: factDocument(value => { value[1] = 'm'.repeat(300) }) },
  { name: 'fractional input', text: factDocument(value => { value[2] = 1.5 }) },
  { name: 'negative output', text: factDocument(value => { value[3] = -1 }) },
  { name: 'negative cacheRead', text: factDocument(value => { value[4] = -1 }) },
  { name: 'unsafe cacheWrite', text: factDocument(value => { value[5] = 2 ** 53 }) },
  { name: 'unknown fact flags', text: factDocument(value => { value[6] = 8 }) },
  { name: 'attempts not an array', text: sessionDocument(session => { session[6] = 'nope' }) },
  { name: 'invalid attempt time', text: sessionDocument(session => { session[6] = [1.5] }) },
  { name: 'invalid unattributed time', text: sessionDocument(session => { session[7] = [-1] }) },
  { name: 'duplicate session id', text: documentWith(document => { document.sessions.push(document.sessions[0]) }) },
]

it.each(malformed)('discards a cache with $name', ({ text }) => {
  expect(decodeFoldCache(text)).toBeUndefined()
})

it('writes and reads a valid file without leaving temporary files', async () => {
  const entries = new Map([['session-a', entry()]])
  expect(await saveFoldCache(path, entries)).toBe(true)
  expect(await loadFoldCache(path)).toEqual(entries)
  expect(await readdir(dirname(path))).toEqual(['analytics-folds.v1.json'])
})

it('treats a missing, corrupt or invalid file as an empty cache', async () => {
  expect((await loadFoldCache(path)).size).toBe(0)
  await writeFile(path, '{')
  expect((await loadFoldCache(path)).size).toBe(0)
  await writeFile(path, sessionDocument(session => { session[1] = '' }))
  expect((await loadFoldCache(path)).size).toBe(0)
})

it('rejects an oversized document before parsing it', async () => {
  expect(await saveFoldCache(path, [['session-a', entry()]])).toBe(true)
  expect((await loadFoldCache(path, { maxBytes: 8 })).size).toBe(0)
})

it('writes an empty envelope for an empty cache', async () => {
  expect(await saveFoldCache(path, [])).toBe(true)
  expect(decodeFoldCache(await readFile(path, 'utf8'))?.size).toBe(0)
})

it('skips entries the decoder would reject instead of poisoning the file', async () => {
  expect(await saveFoldCache(path, [
    ['session-good', entry()],
    ['session-bad', entry({ facts: [fact({ model: 'm'.repeat(300) })] })],
  ])).toBe(true)
  expect([...(await loadFoldCache(path)).keys()]).toEqual(['session-good'])
})

it('returns false instead of throwing when the cache directory is blocked', async () => {
  const blocked = join(root, 'blocked')
  await writeFile(blocked, 'not a directory')
  await expect(saveFoldCache(join(blocked, 'analytics-folds.v1.json'), [['session-a', entry()]]))
    .resolves.toBe(false)
})

it('evicts the oldest storedAt entries until the document fits the byte cap', async () => {
  const all: [string, AnalyticsFoldEntry][] = [
    ['oldest', entry({ storedAt: 100, revision: 'r-100', facts: [fact({ model: 'm'.repeat(80) })] })],
    ['middle', entry({ storedAt: 200, revision: 'r-200', facts: [fact({ model: 'm'.repeat(80) })] })],
    ['newest', entry({ storedAt: 300, revision: 'r-300', facts: [fact({ model: 'm'.repeat(80) })] })],
  ]
  const two = Buffer.byteLength(encodeFoldCache(all.slice(1)))
  expect(await saveFoldCache(path, all, { maxBytes: two + 16 })).toBe(true)
  const loaded = await loadFoldCache(path)
  expect([...loaded.keys()]).toEqual(['middle', 'newest'])
  expect(loaded.get('newest')?.revision).toBe('r-300')
  // Without the cap all three entries are kept.
  expect(await saveFoldCache(path, all)).toBe(true)
  expect((await loadFoldCache(path)).size).toBe(3)
})
