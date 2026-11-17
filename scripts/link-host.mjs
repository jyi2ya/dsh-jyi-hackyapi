/**
 * 把宿主 DSH 的 `@deepseek-ai/*` 包链接进本仓库的 node_modules。
 *
 * npm install 会清掉手工建立的符号链接，装完依赖后重新跑一次即可。
 * 宿主位置按 `DSH_HOST` → `dsh` 所在目录的 npx 树 → 最新的 npx 树顺序查找。
 */
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { homedir } from 'node:os'

/** 需要链接的宿主包。 */
const PACKAGES = ['cordis', 'cordis-plugin-loader', 'cordis-plugin-include', 'dsh-agent-preset-registry']

/** 找到包含 @deepseek-ai 包的 node_modules 目录。 */
function findHostModules() {
  const explicit = process.env.DSH_HOST
  if (explicit !== undefined && explicit.length > 0) {
    const modules = join(explicit, 'node_modules')
    if (existsSync(join(modules, '@deepseek-ai', 'cordis'))) return modules
    throw new Error(`DSH_HOST=${explicit} has no @deepseek-ai/cordis under node_modules`)
  }
  const npxRoot = join(homedir(), '.npm', '_npx')
  if (existsSync(npxRoot)) {
    const trees = readdirSync(npxRoot)
      .map((name) => join(npxRoot, name, 'node_modules'))
      .filter((dir) => existsSync(join(dir, '@deepseek-ai', 'cordis')))
      .sort()
      .reverse()
    if (trees.length > 0) return trees[0]
  }
  try {
    const bin = execSync('command -v dsh', { encoding: 'utf8' }).trim()
    if (bin.length > 0) {
      const modules = join(bin, '..', '..', 'node_modules')
      if (existsSync(join(modules, '@deepseek-ai', 'cordis'))) return modules
    }
  } catch {
    // 没有 dsh 命令时继续报错。
  }
  throw new Error('cannot locate the host DSH tree; set DSH_HOST to the npx package root')
}

const host = findHostModules()
const scope = join(import.meta.dirname, 'node_modules', '@deepseek-ai')
mkdirSync(scope, { recursive: true })
for (const name of PACKAGES) {
  const target = join(scope, name)
  rmSync(target, { recursive: true, force: true })
  symlinkSync(join(host, '@deepseek-ai', name), target, 'dir')
}
console.log(`linked ${PACKAGES.length} host packages from ${host}`)
