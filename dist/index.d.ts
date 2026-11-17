/**
 * dsh-jyi-hackyapi — 稳定门面。
 *
 * 宿主半边把 DSH 内部实现上的缺口包装成能力接口；浏览器半边（`./client`）提供
 * Web UI 插件共用的锚点与弹层工具。两半都可以被消费者按公开导出引用。
 */
export declare const name = "dsh-jyi-hackyapi";
/** 当前验证过的 DSH 版本；`doctor` 用它判断报告基线。 */
export declare const VERIFIED_DSH = "0.2.2-rc.1";
/** 宿主行没有启动逻辑：它存在的意义是让本包成为 bundle，客户端模块随之被扫描。 */
export declare function apply(): void;
export { appendToGroup, findRow, inherit, removeRow, replaceRow, } from './capabilities/presets.js';
export type { InheritOptions, InheritedPreset, PresetRow } from './capabilities/presets.js';
