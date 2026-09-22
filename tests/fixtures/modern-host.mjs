import { createRequire, registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/** Resolve every shared identity from the independently pinned 0.1.7 host. */
export async function useModernHost() {
  const anchor = new URL('../hosts/v017/package.json', import.meta.url)
  const requireHost = createRequire(anchor)
  const manifest = JSON.parse(await readFile(anchor, 'utf8'))
  const modules = new Map(Object.keys(manifest.dependencies)
    .map(id => [id, pathToFileURL(requireHost.resolve(id)).href]))
  registerHooks({ resolve(id, context, next) {
    return modules.has(id) ? { url: modules.get(id), shortCircuit: true } : next(id, context)
  } })
}
