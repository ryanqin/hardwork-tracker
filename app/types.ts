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
