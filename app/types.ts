export type Category = '编程' | '学习' | '健身' | '写作' | '其他'

export interface WorkRecord {
  id: string
  date: string // YYYY-MM-DD
  category: Category
  minutes: number
  note?: string
  createdAt: string
}

export interface DailyStats {
  date: string
  totalMinutes: number
  records: WorkRecord[]
}

// ── 自定义追踪器 ──────────────────────────────────────────────
export type TrackerUnit = 'minutes' | 'pages' | 'problems' | 'times'

export const UNIT_LABELS: Record<TrackerUnit, string> = {
  minutes: '分钟',
  pages: '页',
  problems: '题',
  times: '次',
}

export interface Tracker {
  id: string
  name: string
  emoji: string
  unit: TrackerUnit
  dailyTarget: number   // 每日目标量
  createdAt: string
}

export interface TrackerLog {
  id: string
  trackerId: string
  date: string
  value: number
  note?: string
  createdAt: string
}
