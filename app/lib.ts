import { WorkRecord, DailyStats } from './types'

const STORAGE_KEY = 'hardwork_records'

export function getRecords(): WorkRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveRecord(record: Omit<WorkRecord, 'id' | 'createdAt'>): WorkRecord {
  const records = getRecords()
  const newRecord: WorkRecord = {
    ...record,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }
  records.push(newRecord)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  return newRecord
}

export function deleteRecord(id: string): void {
  const records = getRecords().filter(r => r.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0]
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
  const sortedDates = Array.from(dates).sort().reverse()

  let current = 0
  let best = 0
  let streak = 0
  let prev = ''

  const today = getToday()
  const hasToday = dates.has(today)

  // Check streak going backwards from today
  let checkDate = new Date()
  if (!hasToday) {
    checkDate.setDate(checkDate.getDate() - 1)
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (dates.has(dateStr)) {
      streak++
      if (i === 0 || i === (hasToday ? 0 : 0)) current = streak
    } else {
      break
    }
    checkDate.setDate(checkDate.getDate() - 1)
  }
  current = streak

  // Calculate best streak
  let tempStreak = 0
  const allDates = Array.from(dates).sort()
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      tempStreak = 1
    } else {
      const prev = new Date(allDates[i - 1])
      const curr = new Date(allDates[i])
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (diff === 1) {
        tempStreak++
      } else {
        tempStreak = 1
      }
    }
    best = Math.max(best, tempStreak)
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

export const CATEGORY_COLORS: Record<string, string> = {
  编程: '#000000',
  学习: '#333333',
  健身: '#555555',
  写作: '#777777',
  其他: '#999999',
}

export const CATEGORY_EMOJI: Record<string, string> = {
  编程: '💻',
  学习: '📚',
  健身: '💪',
  写作: '✍️',
  其他: '⚡',
}
