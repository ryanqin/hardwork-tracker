import { WorkRecord, DailyStats } from './types'

// ── API helpers ──────────────────────────────────────────────
export async function getRecords(): Promise<WorkRecord[]> {
  const res = await fetch('/api/records', { cache: 'no-store' })
  if (!res.ok) return []
  return res.json()
}

export async function saveRecord(record: Omit<WorkRecord, 'id' | 'createdAt'>): Promise<WorkRecord> {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  })
  return res.json()
}

export async function deleteRecord(id: string): Promise<void> {
  await fetch('/api/records', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

// ── Pure utils ───────────────────────────────────────────────
export function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getTodayStats(records: WorkRecord[]): DailyStats {
  const today = getToday()
  const todayRecords = records.filter(r => r.date === today)
  return {
    date: today,
    totalMinutes: todayRecords.reduce((sum, r) => sum + r.minutes, 0),
    records: todayRecords,
  }
}

export function getStreak(records: WorkRecord[]): { current: number; best: number } {
  if (records.length === 0) return { current: 0, best: 0 }
  const dates = new Set(records.map(r => r.date))
  const today = getToday()

  // current streak
  let current = 0
  const d = new Date()
  if (!dates.has(today)) d.setDate(d.getDate() - 1)
  for (let i = 0; i < 365; i++) {
    if (dates.has(d.toISOString().split('T')[0])) {
      current++
      d.setDate(d.getDate() - 1)
    } else break
  }

  // best streak
  const sorted = Array.from(dates).sort()
  let best = 0, temp = 0
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) { temp = 1 } else {
      const prev = new Date(sorted[i - 1])
      const curr = new Date(sorted[i])
      const diff = (curr.getTime() - prev.getTime()) / 86400000
      temp = diff === 1 ? temp + 1 : 1
    }
    best = Math.max(best, temp)
  }

  return { current, best }
}

export function getLast30DaysStats(records: WorkRecord[]): DailyStats[] {
  const result: DailyStats[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayRecords = records.filter(r => r.date === dateStr)
    result.push({
      date: dateStr,
      totalMinutes: dayRecords.reduce((sum, r) => sum + r.minutes, 0),
      records: dayRecords,
    })
  }
  return result
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`
}

export const CATEGORY_EMOJI: Record<string, string> = {
  编程: '💻', 学习: '📚', 健身: '💪', 写作: '✍️', 其他: '⚡',
}
