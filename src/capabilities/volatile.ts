/**
 * volatile — 运行时修改其他 Loader 行的配置。
 *
 * `Entry.update()` 在“只有 config 变化、且变化全部落在 schema 声明的 volatile
 * 字段上”时把新值提交进正在运行的引用，并发出 `loader/volatile-update`，宿主行
 * 因此不必卸载重挂。`piAiProviders` 在这条路径上提供 pi-ai 适配器的 provider
 * 字典读写：其它 provider 保持不变，只增删改调用方关心的路由。存在 settings
 * 服务时，provider 表经它持久化，后续重载按配置恢复。
 *
 * 行按 `options.id` 在 Loader 树里查找：profile 的条目挂在 include 子树下，
 * 根树的 `resolve()` 走不到它们。
 */
import { isDeepStrictEqual } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'

/** 一次行配置更新：`update` 拿到当前配置，返回新配置。 */
export interface RowConfigUpdate<T extends Record<string, unknown>> {
  /** Loader 行 id。 */
  id: string
  /** 纯函数：当前配置 → 新配置。 */
  update: (current: T) => T
}

/** pi-ai 适配器里一个 provider 路由的配置。 */
export type PiAiProviderProfile = Record<string, unknown>

/** pi-ai provider 字典的读写句柄。 */
export interface PiAiProvidersHandle {
  /** 当前 provider 字典。 */
  read(): Record<string, PiAiProviderProfile>
  /** 整体替换 provider 字典。 */
  publish(providers: Record<string, PiAiProviderProfile>): Promise<void>
  /** 增改一条路由；`profile` 为 `undefined` 时删除这条路由。 */
  update(name: string, profile: PiAiProviderProfile | undefined): Promise<void>
}

type RowEntry = {
  options: { id: string; config?: unknown }
  update(options: { config: Record<string, unknown> }, create?: boolean, force?: boolean): Promise<void>
}

function findRow(ctx: Context, id: string): RowEntry {
  const loader = ctx.get('loader')
  if (loader === undefined) {
    throw new Error('dsh-jyi-hackyapi: row config updates require the loader service')
  }
  const matches: RowEntry[] = []
  for (const entry of loader.entries()) {
    if (entry.options.id === id) matches.push(entry as unknown as RowEntry)
  }
  if (matches.length === 0) throw new Error(`dsh-jyi-hackyapi: loader row "${id}" was not found`)
  if (matches.length > 1) throw new Error(`dsh-jyi-hackyapi: loader row "${id}" is ambiguous (${matches.length} entries)`)
  return matches[0]
}

/** 读一行当前生效的配置。 */
export function readRowConfig<T extends Record<string, unknown>>(ctx: Context, id: string): T {
  return (findRow(ctx, id).options.config ?? {}) as T
}

/**
 * 提交一行的配置更新；返回写入的新配置。
 *
 * 只改 volatile 字段时宿主不会重挂，`loader/volatile-update` 交给该行的插件自己
 * 处理；改了普通字段则按 Loader 的常规更新语义重挂。
 */
export async function updateRowConfig<T extends Record<string, unknown>>(
  ctx: Context,
  options: RowConfigUpdate<T>,
): Promise<T> {
  const entry = findRow(ctx, options.id)
  const next = options.update((entry.options.config ?? {}) as T)
  await entry.update({ config: next }, false, true)
  return next
}

/** Settings service surface used to persist a row's volatile section. */
interface SettingsWriter {
  replace(ns: string, section: Record<string, unknown>): Promise<void>
}

/**
 * Write the provider table and keep it available across later reloads.
 *
 * With a settings service the section is persisted through the profile's own
 * config document, so a reload restores it; without one the value only lives in
 * the running entry. An unchanged table writes nothing, which also keeps the
 * write-triggered reload from looping.
 */
async function writeProviders(
  ctx: Context,
  row: string,
  providers: Record<string, PiAiProviderProfile>,
): Promise<void> {
  if (isDeepStrictEqual(readRowConfig<{ providers?: unknown }>(ctx, row).providers ?? {}, providers)) return
  const settings = ctx.get('settings') as unknown as SettingsWriter | undefined
  if (settings !== undefined) {
    // `replace` starts from the inherited section, so a route removed from the
    // table disappears from the persisted document too; `update` would merge
    // the dict and keep the stale route.
    await settings.replace(row, { providers })
    return
  }
  await updateRowConfig<{ providers?: Record<string, PiAiProviderProfile> }>(ctx, {
    id: row,
    update: (current) => ({ ...current, providers }),
  })
}

/** 以 volatile 方式读写 pi-ai 适配器的 provider 字典。 */
export function piAiProviders(ctx: Context, options: { row: string }): PiAiProvidersHandle {
  type Config = { providers?: Record<string, PiAiProviderProfile> }
  const row = options.row
  return {
    read: () => readRowConfig<Config>(ctx, row).providers ?? {},
    async publish(providers) {
      await writeProviders(ctx, row, providers)
    },
    async update(name, profile) {
      const providers = { ...(readRowConfig<Config>(ctx, row).providers ?? {}) }
      if (profile === undefined) delete providers[name]
      else providers[name] = profile
      await writeProviders(ctx, row, providers)
    },
  }
}
