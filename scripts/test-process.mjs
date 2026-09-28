import { spawn } from 'node:child_process'

/** Use the current npm CLI, including on Windows where npm.cmd needs a shell. */
export function npm(args, cwd, options = {}) {
  const cli = process.env.npm_execpath
  if (!cli) throw new Error('Run this check through npm run so npm_execpath is available.')
  return run(process.execPath, [cli, ...args], { cwd, ...options })
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} failed (${signal ?? code})`))
    })
  })
}
