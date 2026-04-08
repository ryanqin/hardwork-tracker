import { Tracker, TrackerLog, UNIT_LABELS } from './types'

export async function getTrackers(): Promise<Tracker[]> {
  const res = await fetch('/api/trackers', { cache: 'no-store' })
  return res.ok ? res.json() : []
}

export async function createTracker(data: Omit<Tracker, 'id' | 'createdAt'>): Promise<Tracker> {
  const res = await fetch('/api/trackers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteTracker(id: string): Promise<void> {
  await fetch('/api/trackers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

export async function getTrackerLogs(): Promise<TrackerLog[]> {
  const res = await fetch('/api/tracker-logs', { cache: 'no-store' })
  return res.ok ? res.json() : []
}

export async function addTrackerLog(data: Omit<TrackerLog, 'id' | 'createdAt'>): Promise<TrackerLog> {
  const res = await fetch('/api/tracker-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function deleteTrackerLog(id: string): Promise<void> {
  await fetch('/api/tracker-logs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

export function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function getTodayValue(logs: TrackerLog[], trackerId: string): number {
  return logs
    .filter(l => l.trackerId === trackerId && l.date === getToday())
    .reduce((s, l) => s + l.value, 0)
}

export function getTrackerStreak(logs: TrackerLog[], tracker: Tracker): number {
  const dates = new Set(
    logs
      .filter(l => l.trackerId === tracker.id)
      .filter(l => {
        const dayTotal = logs
          .filter(ll => ll.trackerId === tracker.id && ll.date === l.date)
          .reduce((s, ll) => s + ll.value, 0)
        return dayTotal >= tracker.dailyTarget
      })
      .map(l => l.date)
  )

  let streak = 0
  const d = new Date()
  const today = getToday()
  const todayVal = getTodayValue(logs, tracker.id)
  if (todayVal < tracker.dailyTarget) d.setDate(d.getDate() - 1)

  for (let i = 0; i < 365; i++) {
    if (dates.has(d.toISOString().split('T')[0])) {
      streak++
      d.setDate(d.getDate() - 1)
    } else break
  }
  return streak
}

export function getLast30Days(logs: TrackerLog[], trackerId: string): { date: string; value: number }[] {
  const result = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = d.toISOString().split('T')[0]
    const value = logs
      .filter(l => l.trackerId === trackerId && l.date === date)
      .reduce((s, l) => s + l.value, 0)
    result.push({ date, value })
  }
  return result
}

export { UNIT_LABELS }
