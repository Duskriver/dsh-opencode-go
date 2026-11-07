/**
 * Lightweight repository hygiene gate instead of introducing a full linter:
 * tracked `src/`, `scripts/` and `tests/` sources must be UTF-8 without a BOM,
 * use LF line endings, carry no trailing whitespace and end with exactly one
 * newline. Tabs are rejected in `src/` and `scripts/`; `tests/` is exempt
 * because fixtures may embed literal tab characters. Run as
 * `npm run check:hygiene`, which is part of `npm run verify`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SOURCE_EXTENSIONS = /\.(?:ts|tsx|mjs|js|css|json)$/
const TAB_FREE_PREFIXES = ['src/', 'scripts/']

let files
try {
  files = execFileSync('git', ['ls-files', '-z', '--', 'src', 'scripts', 'tests'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).split('\0').filter(path => SOURCE_EXTENSIONS.test(path))
} catch {
  console.error('check-source: git ls-files failed; run this check from a git checkout')
  process.exit(2)
}

const problems = []
for (const path of files) {
  const bytes = readFileSync(path)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    problems.push(`${path}:1: UTF-8 BOM is not allowed`)
  }
  const text = bytes.toString('utf8')
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const position = index + 1
    if (line.includes('\r')) problems.push(`${path}:${position}: CRLF line ending (use LF)`)
    if (/[ \t]+$/.test(line)) problems.push(`${path}:${position}: trailing whitespace`)
    if (TAB_FREE_PREFIXES.some(prefix => path.startsWith(prefix)) && line.includes('\t')) {
      problems.push(`${path}:${position}: tab character is not allowed in src/ or scripts/`)
    }
  }
  if (text.length > 0) {
    const finalNewlines = /(\n+)$/.exec(text)?.[1].length ?? 0
    if (finalNewlines !== 1) problems.push(`${path}:${lines.length}: file must end with exactly one newline (found ${finalNewlines})`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  console.error(`FAIL: ${problems.length} hygiene problem(s) in ${files.length} tracked source files`)
  process.exit(1)
}
console.log(`PASS: ${files.length} tracked source files are clean (UTF-8, LF, no trailing whitespace, single final newline)`)
