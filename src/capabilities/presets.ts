/**
 * presets — 从一个已声明的 preset 派生变体。
 *
 * 派生完全走公开接口：读取源 preset 的插件行（`readDocument`）、结构化变换、
 * 再用 `register` 挂进 roster。派生出的 preset 只存在于内存，随声明它的插件
 * 一起卸载，不产生任何配置文件。
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { load } from 'js-yaml'

/** preset 里的一个插件行；嵌套组行的 `config` 是子行数组。 */
export type PresetRow = PresetDefinition['plugins'][number]

/** 派生一个 preset 的输入。 */
export interface InheritOptions {
  /** 源 preset id，必须已声明。 */
  from: string
  /** 新 preset id；与已有 id 冲突时失败。 */
  id: string
  /** 展示名；省略时用源 preset 的名字加派生后缀。 */
  name?: string
  /** 一句话描述；省略时沿用源 preset 的。 */
  description?: string
  /** 在 picker 里的排序；省略时沿用源 preset 的。 */
  order?: number
  /** 结构化变换：拿到源 preset 的插件行，返回修改后的行。 */
  transform?: (rows: PresetRow[]) => PresetRow[]
}

/** 派生出的 preset 句柄。 */
export interface InheritedPreset {
  readonly id: string
  /** 从 roster 移除派生 preset。 */
  dispose(): Promise<void>
}

/** 派生一个 preset；注册挂在调用方的 fiber 上，调用方卸载时自动撤销。 */
export async function inherit(ctx: Context, options: InheritOptions): Promise<InheritedPreset> {
  const names = new Set((await ctx.agentPresets.list()).map((preset) => preset.id))
  if (!names.has(options.from)) {
    throw new Error(
      `dsh-jyi-hackyapi: preset "${options.from}" is not declared; available: ${[...names].join(', ')}`,
    )
  }
  const document = await ctx.agentPresets.readDocument(options.from)
  const rows = load(document.content, { schema: entryListSchema })
  if (!Array.isArray(rows)) {
    throw new Error(`dsh-jyi-hackyapi: preset "${options.from}" did not read back as an entry list`)
  }
  const plugins = (options.transform === undefined ? rows : options.transform(rows as PresetRow[])) as PresetRow[]
  const dispose = await ctx.agentPresets.register({
    id: options.id,
    name: options.name ?? `${document.name ?? options.from} (inherited)`,
    ...options.description === undefined
      ? document.description === undefined ? {} : { description: document.description }
      : { description: options.description },
    ...options.order === undefined ? {} : { order: options.order },
    plugins,
  })
  ctx.effect(() => () => dispose())
  return { id: options.id, dispose }
}

/** 组行的子行；非组行返回 undefined。 */
function childrenOf(row: PresetRow): PresetRow[] | undefined {
  return Array.isArray(row.config) ? (row.config as PresetRow[]) : undefined
}

/** 按 id 找行，递归进入嵌套组。 */
export function findRow(rows: readonly PresetRow[], id: string): PresetRow | undefined {
  for (const row of rows) {
    if (row.id === id) return row
    const nested = childrenOf(row)
    const hit = nested === undefined ? undefined : findRow(nested, id)
    if (hit !== undefined) return hit
  }
  return undefined
}

/** 按 id 替换行，递归进入嵌套组；返回新数组，不修改输入。 */
export function replaceRow(rows: readonly PresetRow[], id: string, next: PresetRow): PresetRow[] {
  return rows.map((row) => {
    if (row.id === id) return next
    const nested = childrenOf(row)
    if (nested === undefined) return row
    return { ...row, config: replaceRow(nested, id, next) } as PresetRow
  })
}

/** 按 id 删除行，递归进入嵌套组；返回新数组，不修改输入。 */
export function removeRow(rows: readonly PresetRow[], id: string): PresetRow[] {
  return rows
    .filter((row) => row.id !== id)
    .map((row) => {
      const nested = childrenOf(row)
      return nested === undefined ? row : { ...row, config: removeRow(nested, id) } as PresetRow
    })
}

/** 往嵌套组末尾追加一行，递归查找组；返回新数组，不修改输入。 */
export function appendToGroup(rows: readonly PresetRow[], group: string, row: PresetRow): PresetRow[] {
  return rows.map((current) => {
    const nested = childrenOf(current)
    if (current.id === group && nested !== undefined) {
      return { ...current, config: [...nested, row] } as PresetRow
    }
    if (nested === undefined) return current
    return { ...current, config: appendToGroup(nested, group, row) } as PresetRow
  })
}
