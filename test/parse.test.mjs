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
  assert.equal(parsePay('$40 - $56 a month'), null)
  assert.deepEqual(parsePay('$3,460 - $4,325 per month'), { min: 20, max: 25 })
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
  assert.ok(!isRbtJob('ABA Therapy Scheduler (Remote Position)'))
})

test('normDate handles short aggregator dates', () => {
  assert.equal(normDate(null), null)
  assert.equal(normDate('garbage'), null)
  assert.equal(normDate('2026-09-01').slice(0, 10), '2026-09-01')
  const d = new Date(normDate('24 Sep'))
  assert.equal(d.getMonth(), 8)
  assert.ok(d <= new Date(Date.now() + 864e5))
  assert.ok(Date.now() - d < 366 * 864e5)
  assert.ok(Date.now() - new Date(normDate('12 Aug')) < 366 * 864e5)
})

test('parseWeeklyHours reads weekly hour offers', async () => {
  const { parseWeeklyHours } = await import('../src/parse.mjs')
  assert.deepEqual(parseWeeklyHours('Part-time, 20-29 hours per week'), { min: 20, max: 29 })
  assert.deepEqual(parseWeeklyHours('Guaranteed 25 hrs/week'), { min: 25, max: 25 })
  assert.deepEqual(parseWeeklyHours('up to 30 hours a week available'), { min: null, max: 30 })
  assert.deepEqual(parseWeeklyHours('minimum 15 hours weekly'), { min: 15, max: null })
  assert.deepEqual(parseWeeklyHours('20+ hours per week'), { min: 20, max: null })
  assert.deepEqual(parseWeeklyHours('Weekly hours: 10 - 15'), { min: 10, max: 15 })
  assert.equal(parseWeeklyHours('40-hour RBT training'), null)
  assert.equal(parseWeeklyHours('24 hours notice required'), null)
  assert.equal(parseWeeklyHours('nothing'), null)
  assert.equal(parseWeeklyHours('Quarterly Bonus - $500 (for averaging 25 hours a week for the entire quarter)'), null)
  assert.deepEqual(parseWeeklyHours('Bonus for 30 hours/week average.\nSchedule: 20 hours per week'), { min: 20, max: 20 })
  assert.deepEqual(parseWeeklyHours('5.5-6.5 hours per week'), { min: 5.5, max: 6.5 })
  assert.deepEqual(parseWeeklyHours('Miami Beach, FL | 30 Hours/Week'), { min: 30, max: 30 })
})

test('detectShifts labels morning, afternoon or both', async () => {
  const { detectShifts } = await import('../src/parse.mjs')
  assert.equal(detectShifts('after school sessions 3-7pm'), 'afternoon')
  assert.equal(detectShifts('School-based, 8am-2pm'), 'morning')
  assert.equal(detectShifts('morning & afternoon cases are available!'), 'both')
  assert.equal(detectShifts('Hours: 8:00am - 5:00pm'), 'both')
  assert.equal(detectShifts('great team'), null)
})

test('parsePayAll combines every hourly figure in a description', async () => {
  const { parsePayAll } = await import('../src/parse.mjs')
  assert.deepEqual(parsePayAll('• Competitive Pay: $20 (If RBT certified, then $22-27 based on experience in ABA)'), { min: 20, max: 27 })
  assert.deepEqual(parsePayAll('Pay $22/hr. $500 sign on bonus! Mileage paid at $0.67 per mile.'), { min: 22, max: 22 })
  assert.deepEqual(parsePayAll('RBT: $24 - $28 per hour.\nBCBA rate $80/hr'), { min: 24, max: 28 })
  assert.equal(parsePayAll('no pay'), null)
})
