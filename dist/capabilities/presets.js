import { entryListSchema } from '@deepseek-ai/cordis-plugin-include';
import { load } from 'js-yaml';
/** 派生一个 preset；注册挂在调用方的 fiber 上，调用方卸载时自动撤销。 */
export async function inherit(ctx, options) {
    const names = new Set((await ctx.agentPresets.list()).map((preset) => preset.id));
    if (!names.has(options.from)) {
        throw new Error(`dsh-jyi-hackyapi: preset "${options.from}" is not declared; available: ${[...names].join(', ')}`);
    }
    const document = await ctx.agentPresets.readDocument(options.from);
    const rows = load(document.content, { schema: entryListSchema });
    if (!Array.isArray(rows)) {
        throw new Error(`dsh-jyi-hackyapi: preset "${options.from}" did not read back as an entry list`);
    }
    const plugins = (options.transform === undefined ? rows : options.transform(rows));
    const dispose = await ctx.agentPresets.register({
        id: options.id,
        name: options.name ?? `${document.name ?? options.from} (inherited)`,
        ...options.description === undefined
            ? document.description === undefined ? {} : { description: document.description }
            : { description: options.description },
        ...options.order === undefined ? {} : { order: options.order },
        plugins,
    });
    ctx.effect(() => () => dispose());
    return { id: options.id, dispose };
}
/** 组行的子行；非组行返回 undefined。 */
function childrenOf(row) {
    return Array.isArray(row.config) ? row.config : undefined;
}
/** 按 id 找行，递归进入嵌套组。 */
export function findRow(rows, id) {
    for (const row of rows) {
        if (row.id === id)
            return row;
        const nested = childrenOf(row);
        const hit = nested === undefined ? undefined : findRow(nested, id);
        if (hit !== undefined)
            return hit;
    }
    return undefined;
}
/** 按 id 替换行，递归进入嵌套组；返回新数组，不修改输入。 */
export function replaceRow(rows, id, next) {
    return rows.map((row) => {
        if (row.id === id)
            return next;
        const nested = childrenOf(row);
        if (nested === undefined)
            return row;
        return { ...row, config: replaceRow(nested, id, next) };
    });
}
/** 按 id 删除行，递归进入嵌套组；返回新数组，不修改输入。 */
export function removeRow(rows, id) {
    return rows
        .filter((row) => row.id !== id)
        .map((row) => {
        const nested = childrenOf(row);
        return nested === undefined ? row : { ...row, config: removeRow(nested, id) };
    });
}
/** 往嵌套组末尾追加一行，递归查找组；返回新数组，不修改输入。 */
export function appendToGroup(rows, group, row) {
    return rows.map((current) => {
        const nested = childrenOf(current);
        if (current.id === group && nested !== undefined) {
            return { ...current, config: [...nested, row] };
        }
        if (nested === undefined)
            return current;
        return { ...current, config: appendToGroup(nested, group, row) };
    });
}
