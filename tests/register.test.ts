import type { On, OpEventResult } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

type FetchAnswer = OpEventResult<'http.fetch'>

const POLL_MS = 60_000
const SUMMARY_URL = 'https://www.githubstatus.com/api/v2/summary.json'
const SESSION = { cwd: '/', surface: 'terminal', isInteractive: true } as const

const OPERATIONAL = response(
  summary('none', 'All Systems Operational', { 'Git Operations': 'operational' }),
)
const PARTIAL = response(
  summary('minor', 'Partial System Outage', {
    'Git Operations': 'operational',
    Actions: 'partial_outage',
    Pages: 'degraded_performance',
  }),
)
const ACTIONS_ONLY = response(
  summary('minor', 'Partial System Outage', { Actions: 'partial_outage' }),
)
const REFUSED: FetchAnswer = { deny: 'refused' }

const OPERATIONAL_LINE = '✓ GitHub: All Systems Operational'
const PARTIAL_LINE = '▲ GitHub: Partial System Outage (Actions, Pages)'
const ACTIONS_ONLY_LINE = '▲ GitHub: Partial System Outage (Actions)'
const UNAVAILABLE_LINE = '? GitHub: status unavailable'

function summary(
  indicator: string,
  description: string,
  components: Record<string, string>,
): string {
  return JSON.stringify({
    status: { indicator, description },
    components: Object.entries(components).map(([name, status]) => ({ name, status })),
  })
}

function response(text: string, status = 200): FetchAnswer {
  return { value: { status, ok: status >= 200 && status < 300, headers: {}, text } }
}

function setup(on: On) {
  const clock = mock.clock(on)
  const lines: (string | undefined)[] = []
  const toasts: string[] = []

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('ui.status', ($, e) => {
    lines.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })

  return { clock, lines, toasts }
}

function serve(on: On, ...answers: FetchAnswer[]) {
  on('http.fetch', ($, e) => {
    expect(e.url).toBe(SUMMARY_URL)
    return answers.shift() ?? { deny: 'no answer left to serve' }
  })
}

test('shows the status when the session starts', async ($, on) => {
  const { clock, lines } = setup(on)
  serve(on, OPERATIONAL)

  await $.session.start(SESSION)
  await clock.settle()

  expect(lines).toEqual([OPERATIONAL_LINE])
})

test('names the components that are not operational', async ($, on) => {
  const { clock, lines } = setup(on)
  serve(on, PARTIAL)

  await $.session.start(SESSION)
  await clock.settle()

  expect(lines).toEqual([PARTIAL_LINE])
})

test('toasts only when the indicator changes', async ($, on) => {
  const { clock, lines, toasts } = setup(on)
  serve(on, OPERATIONAL, OPERATIONAL, PARTIAL, ACTIONS_ONLY, OPERATIONAL)

  await $.session.start(SESSION)
  await clock.advance(4 * POLL_MS)

  expect(lines).toEqual([
    OPERATIONAL_LINE,
    OPERATIONAL_LINE,
    PARTIAL_LINE,
    ACTIONS_ONLY_LINE,
    OPERATIONAL_LINE,
  ])
  expect(toasts).toEqual([PARTIAL_LINE, OPERATIONAL_LINE])
})

test('shows unavailable when the status cannot be read', async ($, on) => {
  const { clock, lines, toasts } = setup(on)
  serve(
    on,
    response(summary('none', 'All Systems Operational', {}), 503),
    response('<html>'),
    response('{}'),
    REFUSED,
  )

  await $.session.start(SESSION)
  await clock.advance(3 * POLL_MS)

  expect(lines).toEqual(Array(4).fill(UNAVAILABLE_LINE))
  expect(toasts).toEqual([])
})

test('toasts a change that happened while the status was unavailable', async ($, on) => {
  const { clock, lines, toasts } = setup(on)
  serve(on, OPERATIONAL, REFUSED, PARTIAL)

  await $.session.start(SESSION)
  await clock.advance(2 * POLL_MS)

  expect(lines).toEqual([OPERATIONAL_LINE, UNAVAILABLE_LINE, PARTIAL_LINE])
  expect(toasts).toEqual([PARTIAL_LINE])
})
