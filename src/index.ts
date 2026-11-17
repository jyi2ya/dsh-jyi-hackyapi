/**
 * dsh-jyi-hackyapi — 稳定门面。
 *
 * 门面把一处内部实现细节包装成可替换的能力接口；后端按能力探测选择，
 * 上游提供正式接口后新增后端即可，消费者不变，也不产生配置文件。
 */

export const name = 'dsh-jyi-hackyapi'

/** 当前验证过的 DSH 版本；`doctor` 用它判断报告基线。 */
export const VERIFIED_DSH = '0.2.2-rc.1'

export {
  appendToGroup,
  findRow,
  inherit,
  removeRow,
  replaceRow,
} from './capabilities/presets.js'
export type { InheritOptions, InheritedPreset, PresetRow } from './capabilities/presets.js'
