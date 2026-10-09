/** Settings discovery includes lifecycle data that the host's generic model DTO omits. */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'

export interface GoModel {
  id: string
  name?: string
  contextWindow?: number
  maxTokens?: number
  /** Token budget controls available to this model, including their catalog bounds. */
  reasoningBudget?: ThinkingBudgetRange
  deprecated?: boolean
  releaseDate?: string
  /** Input modalities models.dev declares, in {@link INPUT_MODALITIES} order. */
  inputModalities?: readonly InputModality[]
  /** Advertised by the gateway but lacking a usable protocol and capability configuration. */
  configurationMissing?: boolean
}

export interface ThinkingBudgetRange {
  min: number
  max: number
}

/**
 * Input modalities this page can name. models.dev uses these same five tokens, so
 * an unknown token is dropped rather than rendered as an untranslatable chip.
 */
export const INPUT_MODALITIES = ['text', 'image', 'audio', 'video', 'pdf'] as const
export type InputModality = typeof INPUT_MODALITIES[number]

/**
 * Normalize one `modalities.input` array into display order.
 * @param value - the raw declaration read from models.dev or from a Host response.
 * @returns the declared modalities in {@link INPUT_MODALITIES} order, or
 *   `undefined` when nothing recognizable was declared.
 */
export function normalizeInputModalities(value: unknown): readonly InputModality[] | undefined {
  if (!Array.isArray(value)) return undefined
  const declared = new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.toLowerCase()))
  const ordered = INPUT_MODALITIES.filter(modality => declared.has(modality))
  return ordered.length === 0 ? undefined : ordered
}

/** Last successful check of one catalog source, plus any current refresh failure. */
export interface GoCatalogSourceStatus {
  readonly updatedAt?: number
  readonly error?: string
  readonly warning?: string
}

/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
export interface GoModelCatalog {
  readonly models: readonly GoModel[]
  readonly stale: boolean
  readonly error?: string
  /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
  readonly sources?: { readonly listing: GoCatalogSourceStatus; readonly metadata: GoCatalogSourceStatus }
}

/** Missing configuration cannot be enabled; configured models follow explicit switches or lifecycle defaults. */
export function isModelEnabled(
  model: Pick<GoModel, 'id' | 'deprecated' | 'configurationMissing'>,
  modelVisibility?: Readonly<Record<string, boolean>>,
): boolean {
  if (model.configurationMissing) return false
  const enabled = modelVisibility && Object.hasOwn(modelVisibility, model.id) ? modelVisibility[model.id] : undefined
  return typeof enabled === 'boolean' ? enabled : !model.deprecated
}

export function validReleaseDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

/** Calendar dates are supplied without a timezone; compare UTC dates consistently. */
export function isNewModel(model: GoModel, now = Date.now()): boolean {
  if (model.deprecated || !validReleaseDate(model.releaseDate)) return false
  const days = Math.floor(now / 86_400_000) - Date.parse(model.releaseDate) / 86_400_000
  return days >= 0 && days < 7
}

export function sortModels(models: readonly GoModel[], now = Date.now()): GoModel[] {
  const rank = (model: GoModel): number => model.deprecated ? 2 : isNewModel(model, now) ? 0 : 1
  return [...models].sort((a, b) => rank(a) - rank(b)
    || (isNewModel(a, now) && isNewModel(b, now) ? b.releaseDate!.localeCompare(a.releaseDate!) : 0))
}

export function parseGoModels(value: unknown): GoModel[] {
  if (!Array.isArray(value)) throw new Error('Invalid OpenCode Go model list')
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid OpenCode Go model')
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string' || !row.id) throw new Error('Missing OpenCode Go model id')
    const model: GoModel = { id: row.id }
    if (typeof row.name === 'string') model.name = row.name
    for (const key of ['contextWindow', 'maxTokens'] as const) {
      if (typeof row[key] === 'number' && Number.isSafeInteger(row[key]) && row[key] > 0) model[key] = row[key]
    }
    if (row.reasoningBudget !== null && typeof row.reasoningBudget === 'object') {
      const { min, max } = row.reasoningBudget as Record<string, unknown>
      if (typeof min === 'number' && Number.isSafeInteger(min) && min > 0
        && typeof max === 'number' && Number.isSafeInteger(max) && max >= min) model.reasoningBudget = { min, max }
    }
    if (typeof row.deprecated === 'boolean') model.deprecated = row.deprecated
    if (typeof row.configurationMissing === 'boolean') model.configurationMissing = row.configurationMissing
    if (validReleaseDate(row.releaseDate)) model.releaseDate = row.releaseDate
    const modalities = normalizeInputModalities(row.inputModalities)
    if (modalities !== undefined) model.inputModalities = modalities
    return model
  })
}

export function parseGoModelCatalog(value: unknown): GoModelCatalog {
  if (!value || typeof value !== 'object') throw new Error('Invalid OpenCode Go model catalog')
  const catalog = value as Record<string, unknown>
  if (typeof catalog.stale !== 'boolean' || (catalog.error !== undefined && typeof catalog.error !== 'string')) {
    throw new Error('Invalid OpenCode Go model catalog status')
  }
  return {
    models: parseGoModels(catalog.models), stale: catalog.stale,
    ...(catalog.error === undefined ? {} : { error: catalog.error as string }),
    ...(catalog.sources === undefined ? {} : { sources: parseSources(catalog.sources) }),
  }
}

function parseSources(value: unknown): NonNullable<GoModelCatalog['sources']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OpenCode Go catalog sources')
  const sources = value as Record<string, unknown>
  const parse = (value: unknown): GoCatalogSourceStatus => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OpenCode Go catalog source status')
    const source = value as Record<string, unknown>
    if (source.updatedAt !== undefined && (typeof source.updatedAt !== 'number'
      || !Number.isSafeInteger(source.updatedAt) || source.updatedAt < 0 || source.updatedAt > 8_640_000_000_000_000)) {
      throw new Error('Invalid OpenCode Go catalog source timestamp')
    }
    if (source.error !== undefined && typeof source.error !== 'string') throw new Error('Invalid OpenCode Go catalog source error')
    if (source.warning !== undefined && typeof source.warning !== 'string') throw new Error('Invalid OpenCode Go catalog source warning')
    return {
      ...(source.updatedAt === undefined ? {} : { updatedAt: source.updatedAt as number }),
      ...(source.error === undefined ? {} : { error: source.error as string }),
      ...(source.warning === undefined ? {} : { warning: source.warning as string }),
    }
  }
  return { listing: parse(sources.listing), metadata: parse(sources.metadata) }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    opencodeGoModels: { read(): Promise<RemoteResult<GoModelCatalog>> }
  }
}
const codec = { mode: 'strict' as const, typeSymbol: 'dsh-opencode-go#GoModelCatalog',
  schema: { parse: parseGoModelCatalog }, create: () => ({ parse: parseGoModelCatalog }) }
export const modelsRemote: TypertRemoteContribution = {
  package: 'dsh-opencode-go',
  descriptors: [{ id: 'dsh-opencode-go#opencodeGoModels/read', service: 'opencodeGoModels',
    namespace: 'opencodeGoModels', method: 'read', invocation: { kind: 'direct' }, parameters: [], result: codec }],
}
