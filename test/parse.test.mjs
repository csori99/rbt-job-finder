import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normDate, parsePay, scoreSchedule, classifyArea, isRbtJob, extractTimeRanges } from '../src/parse.mjs'

test('parsePay handles hourly ranges', () => {
  assert.deepEqual(parsePay('$20 - $23 an hour'), { min: 20, max: 23 })
  assert.deepEqual(parsePay('Pay: $22.50/hr'), { min: 22.5, max: 22.5 })
  assert.deepEqual(parsePay('$19 to $25 per hour'), { min: 19, max: 25 })
})

test('parsePay converts yearly and ignores junk', () => {
  assert.deepEqual(parsePay('$41,600 - $52,000 a year'), { min: 20, max: 25 })
  assert.equal(parsePay('$500 sign on bonus'), null)
  assert.equal(parsePay('no pay listed'), null)
})

test('scoreSchedule spots afternoon cases', () => {
  assert.equal(scoreSchedule('Afternoon sessions available after school').score, 2)
  assert.equal(scoreSchedule('Hours: 2:00pm - 7:00pm Monday to Friday').score, 2)
  assert.equal(scoreSchedule('Monday-Friday 3-7pm').score, 2)
  assert.equal(scoreSchedule('Part-time, flexible schedule').score, 1)
  assert.equal(scoreSchedule('School-based position, 7:30am to 2:30pm').score, -1)
  assert.equal(scoreSchedule('Mon-Fri 8am-1pm').score, -1)
  assert.equal(scoreSchedule('nothing here').score, 0)
})

test('extractTimeRanges infers am/pm', () => {
  const [r] = extractTimeRanges('8am-4pm')
  assert.equal(r.start, 8)
  assert.equal(r.end, 16)
  const [r2] = extractTimeRanges('3-7pm')
  assert.equal(r2.start, 15)
})

test('classifyArea buckets south florida', () => {
  assert.equal(classifyArea('Hialeah, FL'), 'miami-dade')
  assert.equal(classifyArea('Miami, FL 33186'), 'miami-dade')
  assert.equal(classifyArea('Fort Lauderdale, FL'), 'broward')
  assert.equal(classifyArea('Orlando, FL'), 'other')
})

test('isRbtJob filters titles', () => {
  assert.ok(isRbtJob('Registered Behavior Technician (RBT)'))
  assert.ok(isRbtJob('ABA Therapist - Part Time Afternoons'))
  assert.ok(isRbtJob('Behavior Technician'))
  assert.ok(!isRbtJob('BCBA - Board Certified Behavior Analyst'))
  assert.ok(!isRbtJob('Speech Language Pathologist'))
})

test('normDate handles short aggregator dates', () => {
  assert.equal(normDate(null), null)
  assert.equal(normDate('garbage'), null)
  assert.equal(normDate('2026-09-01').slice(0, 10), '2026-09-01')
  const d = new Date(normDate('24 Sep'))
  assert.equal(d.getMonth(), 8)
  assert.ok(d <= new Date(Date.now() + 864e5))
})
