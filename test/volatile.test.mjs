import { test } from 'node:test'
import assert from 'node:assert/strict'
import { piAiProviders, readRowConfig, updateRowConfig } from '../dist/capabilities/volatile.js'

/** 最小 loader 桩：若干行配置，记录每次 entry.update。 */
function stubContext(rows, options = {}) {
  const updates = []
  const settingsUpdates = []
  const entries = Object.entries(rows).map(([id, config]) => ({
    options: { id, config },
    update: async function (updateOptions) {
      this.options.config = updateOptions.config
      updates.push({ id, config: updateOptions.config })
    },
  }))
  const settings = options.settings === false ? undefined : {
    replace: async (ns, section) => {
      settingsUpdates.push({ ns, section })
      const entry = entries.find((candidate) => candidate.options.id === ns)
      if (entry !== undefined) entry.options.config = { ...entry.options.config, ...section }
    },
  }
  const ctx = {
    get: (name) => {
      if (name === 'loader') return { entries: () => entries }
      if (name === 'settings') return settings
      return undefined
    },
  }
  return { ctx, entries, updates, settingsUpdates }
}

test('readRowConfig 返回当前配置', () => {
  const { ctx } = stubContext({ row: { providers: { a: { api: 'x' } } } })
  assert.deepEqual(readRowConfig(ctx, 'row'), { providers: { a: { api: 'x' } } })
})

test('readRowConfig 对不存在的行报错', () => {
  const { ctx } = stubContext({})
  assert.throws(() => readRowConfig(ctx, 'missing'), /was not found/)
})

test('readRowConfig 对重复 id 报错', () => {
  const { ctx } = stubContext({ row: {} })
  ctx.get = () => ({
    entries: () => [
      { options: { id: 'row', config: {} }, update: async () => {} },
      { options: { id: 'row', config: {} }, update: async () => {} },
    ],
  })
  assert.throws(() => readRowConfig(ctx, 'row'), /ambiguous/)
})

test('缺 loader 服务时报错', () => {
  assert.throws(() => readRowConfig({ get: () => undefined }, 'row'), /loader service/)
})

test('updateRowConfig 用纯函数计算新配置并提交', async () => {
  const { ctx, updates } = stubContext({ row: { providers: { a: { api: 'x' } } } })
  const next = await updateRowConfig(ctx, {
    id: 'row',
    update: (current) => ({ ...current, providers: { ...current.providers, b: { api: 'y' } } }),
  })
  assert.deepEqual(next.providers, { a: { api: 'x' }, b: { api: 'y' } })
  assert.equal(updates.length, 1)
  assert.equal(updates[0].id, 'row')
})

test('piAiProviders 走 settings 持久化：replace 整表写入', async () => {
  const { ctx, entries, settingsUpdates } = stubContext({ row: { providers: { a: { api: 'x' } }, other: 1 } })
  const providers = piAiProviders(ctx, { row: 'row' })
  assert.deepEqual(providers.read(), { a: { api: 'x' } })
  await providers.update('b', { api: 'y' })
  assert.equal(settingsUpdates.length, 1)
  assert.equal(settingsUpdates[0].ns, 'row')
  assert.deepEqual(entries[0].options.config.providers, { a: { api: 'x' }, b: { api: 'y' } })
  await providers.update('a', undefined)
  assert.deepEqual(entries[0].options.config.providers, { b: { api: 'y' } })
  await providers.publish({ c: { api: 'z' } })
  assert.deepEqual(entries[0].options.config.providers, { c: { api: 'z' } })
  assert.equal(entries[0].options.config.other, 1)
})

test('piAiProviders 在无 settings 时退回运行时提交', async () => {
  const { ctx, entries, settingsUpdates, updates } = stubContext(
    { row: { providers: { a: { api: 'x' } } } },
    { settings: false },
  )
  const providers = piAiProviders(ctx, { row: 'row' })
  await providers.update('b', { api: 'y' })
  assert.equal(settingsUpdates.length, 0)
  assert.equal(updates.length, 1)
  assert.deepEqual(entries[0].options.config.providers, { a: { api: 'x' }, b: { api: 'y' } })
})

test('provider 表没有变化时不写配置', async () => {
  const { ctx, settingsUpdates, updates } = stubContext({ row: { providers: { a: { api: 'x' } } } })
  const providers = piAiProviders(ctx, { row: 'row' })
  await providers.publish({ a: { api: 'x' } })
  assert.equal(settingsUpdates.length, 0)
  assert.equal(updates.length, 0)
})
