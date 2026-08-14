import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface SystemMemoryUsage {
  usedBytes: number
  totalBytes: number
}

function parseVmStatPages(vmStat: string): Record<string, number> {
  const pages: Record<string, number> = {}
  for (const line of vmStat.split('\n')) {
    const match = line.match(/^Pages (\w[\w -]*?):\s+(\d+)\.?$/)
    if (match) pages[match[1]] = Number(match[2])
  }
  return pages
}

// macOS reports free/inactive/purgeable pages that the OS can and will
// reclaim on demand (cached file content, etc.) - Activity Monitor excludes
// these from "Memory Used", so we do too. os.totalmem() supplies the total
// since it's reliable, unlike vm_stat's own page-size math on some machines.
export function parseVmStat(vmStat: string, totalBytes: number): SystemMemoryUsage {
  const pageSizeMatch = vmStat.match(/page size of (\d+) bytes/)
  const pageSize = pageSizeMatch ? Number(pageSizeMatch[1]) : 16384
  const pages = parseVmStatPages(vmStat)
  const reclaimablePages = (pages.free ?? 0) + (pages.inactive ?? 0) + (pages.purgeable ?? 0)
  return { usedBytes: totalBytes - reclaimablePages * pageSize, totalBytes }
}

export function parseMeminfo(meminfo: string): SystemMemoryUsage {
  const totalMatch = meminfo.match(/^MemTotal:\s+(\d+) kB$/m)
  const availableMatch = meminfo.match(/^MemAvailable:\s+(\d+) kB$/m)
  const totalKb = totalMatch ? Number(totalMatch[1]) : 0
  const availableKb = availableMatch ? Number(availableMatch[1]) : 0
  return { usedBytes: (totalKb - availableKb) * 1024, totalBytes: totalKb * 1024 }
}

export async function getSystemMemoryUsage(): Promise<SystemMemoryUsage> {
  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('vm_stat')
    return parseVmStat(stdout, os.totalmem())
  }
  const meminfo = await readFile('/proc/meminfo', 'utf-8')
  return parseMeminfo(meminfo)
}
