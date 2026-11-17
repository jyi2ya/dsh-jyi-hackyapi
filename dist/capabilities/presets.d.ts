/**
 * presets — 从一个已声明的 preset 派生变体。
 *
 * 派生完全走公开接口：读取源 preset 的插件行（`readDocument`）、结构化变换、
 * 再用 `register` 挂进 roster。派生出的 preset 只存在于内存，随声明它的插件
 * 一起卸载，不产生任何配置文件。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { PresetDefinition } from '@deepseek-ai/dsh-agent-preset-registry';
/** preset 里的一个插件行；嵌套组行的 `config` 是子行数组。 */
export type PresetRow = PresetDefinition['plugins'][number];
/** 派生一个 preset 的输入。 */
export interface InheritOptions {
    /** 源 preset id，必须已声明。 */
    from: string;
    /** 新 preset id；与已有 id 冲突时失败。 */
    id: string;
    /** 展示名；省略时用源 preset 的名字加派生后缀。 */
    name?: string;
    /** 一句话描述；省略时沿用源 preset 的。 */
    description?: string;
    /** 在 picker 里的排序；省略时沿用源 preset 的。 */
    order?: number;
    /** 结构化变换：拿到源 preset 的插件行，返回修改后的行。 */
    transform?: (rows: PresetRow[]) => PresetRow[];
}
/** 派生出的 preset 句柄。 */
export interface InheritedPreset {
    readonly id: string;
    /** 从 roster 移除派生 preset。 */
    dispose(): Promise<void>;
}
/** 派生一个 preset；注册挂在调用方的 fiber 上，调用方卸载时自动撤销。 */
export declare function inherit(ctx: Context, options: InheritOptions): Promise<InheritedPreset>;
/** 按 id 找行，递归进入嵌套组。 */
export declare function findRow(rows: readonly PresetRow[], id: string): PresetRow | undefined;
/** 按 id 替换行，递归进入嵌套组；返回新数组，不修改输入。 */
export declare function replaceRow(rows: readonly PresetRow[], id: string, next: PresetRow): PresetRow[];
/** 按 id 删除行，递归进入嵌套组；返回新数组，不修改输入。 */
export declare function removeRow(rows: readonly PresetRow[], id: string): PresetRow[];
/** 往嵌套组末尾追加一行，递归查找组；返回新数组，不修改输入。 */
export declare function appendToGroup(rows: readonly PresetRow[], group: string, row: PresetRow): PresetRow[];
