/** Best-effort persistence of public models.dev data, never gateway membership or credentials. */
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { MODEL_METADATA_URL } from './model-metadata.ts'

export const MODEL_METADATA_MAX_BYTES = 16 * 1024 * 1024
// The envelope adds a small amount to the bounded HTTP document.
const CACHE_MAX_BYTES = MODEL_METADATA_MAX_BYTES + 4096

export interface CachedMetadata {
  readonly body: unknown
  readonly etag?: string
  /** Last successful download or HTTP 304 verification. */
  readonly savedAtMs: number
}

export function metadataCachePath(): string {
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  return resolve(home, 'cache', 'dsh-opencode-go', 'models.dev.api.json')
}

/** Only persist validators that can safely become an HTTP request header. */
export function metadataETag(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 1024 && /^(W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(value)
    ? value : undefined
}

export async function readMetadataCache(path: string): Promise<CachedMetadata | undefined> {
  try {
    const info = await stat(path)
    if (!info.isFile() || info.size > CACHE_MAX_BYTES) return undefined
    const chunks: Buffer[] = []
    let size = 0
    // Bound actual bytes as well as stat: another process can replace/grow the file.
    for await (const chunk of createReadStream(path)) {
      const bytes = chunk as Buffer
      size += bytes.length
      if (size > CACHE_MAX_BYTES) return undefined
      chunks.push(bytes)
    }
    const value = JSON.parse(Buffer.concat(chunks, size).toString('utf8')) as Record<string, unknown> | null
    if (!value || value.version !== 1 || value.sourceURL !== MODEL_METADATA_URL
      || typeof value.savedAtMs !== 'number' || !Number.isSafeInteger(value.savedAtMs)
      || value.savedAtMs < 0 || value.savedAtMs > Date.now()
      || (value.etag !== undefined && metadataETag(value.etag) === undefined)) return undefined
    return { body: value.body, savedAtMs: value.savedAtMs, etag: metadataETag(value.etag) }
  } catch {
    // Missing, unreadable or corrupt caches behave like the first launch.
    return undefined
  }
}

export async function writeMetadataCache(path: string, value: CachedMetadata): Promise<void> {
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  try {
    const content = JSON.stringify({ version: 1, sourceURL: MODEL_METADATA_URL, ...value })
    if (Buffer.byteLength(content) > CACHE_MAX_BYTES) return
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
  } catch {
    // Persistence cannot turn a successful online refresh into a catalog failure.
  } finally {
    await rm(temporary, { force: true }).catch(() => {})
  }
}
