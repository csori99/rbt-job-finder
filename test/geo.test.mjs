import { test } from 'node:test'
import assert from 'node:assert/strict'
import { locate } from '../src/geo.mjs'

test('locate gives distances from miami and davie', () => {
  const d = locate('Davie, FL 33314')
  assert.equal(d.fromDavie, 0)
  assert.ok(d.fromMiami > 18 && d.fromMiami < 24)
  const nm = locate('North Miami Beach, FL')
  assert.ok(nm.fromMiami > 10 && nm.fromMiami < 14)
  assert.deepEqual(locate('Somewhere'), { fromMiami: null, fromDavie: null })
  assert.equal(locate('x', { lat: 26.0629, lng: -80.2331 }).fromDavie, 0)
})
