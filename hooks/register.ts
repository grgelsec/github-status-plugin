import type { EngineInterface, Register } from 'claude-code'

type Summary = {
  indicator: string
  description: string
  affected: string[]
}

type Payload = {
  status: { indicator: string; description: string }
  components: { name: string; status: string }[]
}

const SUMMARY_URL = 'https://www.githubstatus.com/api/v2/summary.json'
const POLL_MS = 60_000
const UNAVAILABLE = '? GitHub: status unavailable'

const MARKS: Record<string, string> = {
  none: '✓',
  minor: '▲',
  major: '✖',
  critical: '✖',
  maintenance: '◆',
}

export const register: Register = on => {
  const last: { indicator?: string } = {}

  on('session.start', ($, e, next) => {
    void poll($, last)
    $.clock.every(POLL_MS, () => void poll($, last))

    return next(e)
  })
}

async function poll($: EngineInterface, last: { indicator?: string }) {
  const summary = await fetchSummary($)

  if (summary === undefined) {
    $.ui.status(UNAVAILABLE)
    return
  }

  const line = format(summary)
  $.ui.status(line)

  if (last.indicator !== undefined && last.indicator !== summary.indicator) {
    $.ui.toast(line)
  }
  last.indicator = summary.indicator
}

async function fetchSummary($: EngineInterface): Promise<Summary | undefined> {
  try {
    const response = await $.http.fetch(SUMMARY_URL)

    return response.ok ? parse(response.text) : undefined
  } catch {
    return undefined
  }
}

function parse(text: string): Summary {
  const { status, components } = JSON.parse(text) as Payload
  const affected = components
    .filter(component => component.status !== 'operational')
    .map(component => component.name)

  return { indicator: status.indicator, description: status.description, affected }
}

function format({ indicator, description, affected }: Summary): string {
  const mark = MARKS[indicator] ?? '•'
  const detail = affected.length > 0 ? ` (${affected.join(', ')})` : ''

  return `${mark} GitHub: ${description}${detail}`
}
