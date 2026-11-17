import { test } from 'node:test'
import assert from 'node:assert/strict'
import { appendToGroup, findRow, removeRow, replaceRow } from '../dist/capabilities/presets.js'

const rows = () => [
  { id: 'persona', name: 'x' },
  { id: 'compaction', group: true, config: [{ id: 'compaction-basic', name: 'y' }] },
]

test('findRow walks nested groups', () => {
  assert.equal(findRow(rows(), 'compaction-basic')?.name, 'y')
  assert.equal(findRow(rows(), 'missing'), undefined)
})

test('replaceRow replaces a nested row without mutating the input', () => {
  const input = rows()
  const next = replaceRow(input, 'compaction-basic', { id: 'memory-ladder', name: 'z' })
  assert.equal(findRow(next, 'memory-ladder')?.name, 'z')
  assert.equal(findRow(next, 'compaction-basic'), undefined)
  assert.equal(findRow(input, 'compaction-basic')?.name, 'y')
})

test('removeRow removes a nested row', () => {
  const next = removeRow(rows(), 'compaction-basic')
  assert.equal(findRow(next, 'compaction-basic'), undefined)
})

test('appendToGroup appends to a nested group', () => {
  const next = appendToGroup(rows(), 'compaction', { id: 'extra', name: 'w' })
  const group = findRow(next, 'compaction')
  assert.deepEqual(group?.config?.map((row) => row.id), ['compaction-basic', 'extra'])
})
