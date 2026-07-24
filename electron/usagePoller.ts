import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface UsageSnapshot {
  ts: number
  sessionPct: number
  weeklyPct: number
  requests24h: number
  requests7d: number
  topSkills: { name: string; pct: number }[]
}

export function parseUsageText(text: string): Omit<UsageSnapshot, 'ts'> | null {
  const sessionMatch = text.match(/Current session: (\d+)%/)
  if (!sessionMatch) return null

  const weeklyMatch = text.match(/Current week[^:]*: (\d+)%/)
  const req24hMatch = text.match(/Last 24h · (\d+) requests/)
  const req7dMatch = text.match(/Last 7d · (\d+) requests/)

  const topSkills: { name: string; pct: number }[] = []
  const skillsMatch = text.match(/Last 24h[\s\S]*?Top skills: ([^\n]+)/)
  if (skillsMatch) {
    for (const part of skillsMatch[1].split(', ')) {
      const m = part.match(/(.+?)\s+(\d+)%/)
      if (m) topSkills.push({ name: m[1].replace(/^\//, ''), pct: parseInt(m[2]) })
    }
  }

  return {
    sessionPct: parseInt(sessionMatch[1]),
    weeklyPct: weeklyMatch ? parseInt(weeklyMatch[1]) : 0,
    requests24h: req24hMatch ? parseInt(req24hMatch[1]) : 0,
    requests7d: req7dMatch ? parseInt(req7dMatch[1]) : 0,
    topSkills,
  }
}

export class UsagePoller {
  private snapshots: UsageSnapshot[] = []
  private interval: ReturnType<typeof setInterval> | null = null
  private readonly shell = process.env.SHELL ?? '/bin/zsh'

  async poll(): Promise<void> {
    try {
      const { stdout } = await execFileAsync(
        this.shell,
        ['-lc', 'claude /usage --output-format json'],
        { timeout: 15_000 }
      )
      const jsonLine = stdout.split('\n').find((l) => l.trimStart().startsWith('{'))
      if (!jsonLine) return
      const json = JSON.parse(jsonLine)
      const parsed = parseUsageText(json.result ?? '')
      if (!parsed) return
      this.snapshots.push({ ts: Date.now(), ...parsed })
      if (this.snapshots.length > 60) this.snapshots.shift()
    } catch (e) {
      console.error('UsagePoller poll failed:', e)
    }
  }

  start(): void {
    if (this.interval) return
    void this.poll()
    this.interval = setInterval(() => void this.poll(), 60_000)
  }

  stop(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
  }

  getSnapshots(): UsageSnapshot[] { return this.snapshots }
  getLatest(): UsageSnapshot | null { return this.snapshots.at(-1) ?? null }
}
