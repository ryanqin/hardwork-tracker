'use client'

import { useState, useEffect } from 'react'
import {
  WorkRecord, Category,
} from './types'
import {
  getRecords, saveRecord, deleteRecord,
  getTodayStats, getStreak, getLast30DaysStats,
  formatMinutes, CATEGORY_EMOJI, getToday,
} from './lib'

const CATEGORIES: Category[] = ['编程', '学习', '健身', '写作', '其他']

function HeatmapCell({ minutes, date }: { minutes: number; date: string }) {
  const intensity = minutes === 0 ? 0
    : minutes < 30 ? 1
    : minutes < 60 ? 2
    : minutes < 120 ? 3
    : 4

  const bg = [
    'bg-gray-100',
    'bg-gray-300',
    'bg-gray-500',
    'bg-gray-700',
    'bg-black',
  ][intensity]

  const label = date.split('-').slice(1).join('/')
  return (
    <div
      title={`${label}: ${minutes > 0 ? formatMinutes(minutes) : '无记录'}`}
      className={`w-7 h-7 rounded-sm ${bg} cursor-default transition-transform hover:scale-110`}
    />
  )
}

export default function Home() {
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [category, setCategory] = useState<Category>('编程')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'today' | 'history'>('today')

  useEffect(() => {
    setRecords(getRecords())
  }, [])

  const todayStats = getTodayStats(records)
  const streak = getStreak(records)
  const heatmap = getLast30DaysStats(records)
  const today = getToday()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const mins = parseInt(minutes)
    if (!mins || mins <= 0) return
    setSaving(true)
    const r = saveRecord({ date: today, category, minutes: mins, note: note.trim() || undefined })
    setRecords(prev => [...prev, r])
    setMinutes('')
    setNote('')
    setSaving(false)
  }

  function handleDelete(id: string) {
    deleteRecord(id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const categoryStats = CATEGORIES.map(cat => ({
    cat,
    minutes: todayStats.records.filter(r => r.category === cat).reduce((s, r) => s + r.minutes, 0),
  })).filter(s => s.minutes > 0)

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">苦功夫</h1>
          <p className="text-gray-400 text-sm mt-1">每一分钟都算数</p>
        </div>

        {/* Streak + Today Total */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="border border-black rounded-xl p-4 col-span-2">
            <div className="text-4xl font-black">{formatMinutes(todayStats.totalMinutes)}</div>
            <div className="text-gray-400 text-xs mt-1">今日苦功夫</div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center">
            <div className="text-3xl font-black">{streak.current}</div>
            <div className="text-gray-400 text-xs mt-1">连续天</div>
            <div className="text-gray-300 text-xs">最高 {streak.best}</div>
          </div>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAdd} className="border border-black rounded-xl p-5 mb-8">
          <div className="text-sm font-bold mb-3">记一次苦功夫</div>

          {/* Category */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {CATEGORY_EMOJI[cat]} {cat}
              </button>
            ))}
          </div>

          {/* Duration */}
          <div className="flex gap-2 mb-3">
            <input
              type="number"
              value={minutes}
              onChange={e => setMinutes(e.target.value)}
              placeholder="时长（分钟）"
              min={1}
              max={999}
              required
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black"
            />
            <div className="flex gap-1">
              {[25, 45, 60, 90].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m.toString())}
                  className="px-2 py-1 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="备注（可选）"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-black"
          />

          <button
            type="submit"
            disabled={saving || !minutes}
            className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-bold hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            ＋ 记录
          </button>
        </form>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
          {(['today', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? 'bg-white shadow-sm text-black' : 'text-gray-400'
              }`}
            >
              {t === 'today' ? '今日记录' : '历史热力图'}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <div>
            {/* Category breakdown */}
            {categoryStats.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {categoryStats.map(({ cat, minutes: m }) => (
                  <span key={cat} className="text-xs bg-gray-100 rounded-full px-3 py-1">
                    {CATEGORY_EMOJI[cat]} {cat} {formatMinutes(m)}
                  </span>
                ))}
              </div>
            )}

            {/* Today records */}
            {todayStats.records.length === 0 ? (
              <div className="text-center py-12 text-gray-300">
                <div className="text-4xl mb-2">🔥</div>
                <div className="text-sm">还没有记录，开始你的苦功夫</div>
              </div>
            ) : (
              <div className="space-y-2">
                {todayStats.records.slice().reverse().map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 group">
                    <span className="text-xl">{CATEGORY_EMOJI[r.category]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{r.category} · {formatMinutes(r.minutes)}</div>
                      {r.note && <div className="text-xs text-gray-400 truncate">{r.note}</div>}
                    </div>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div>
            {/* Heatmap */}
            <div className="mb-4">
              <div className="flex gap-1.5 flex-wrap">
                {heatmap.map(day => (
                  <HeatmapCell key={day.date} minutes={day.totalMinutes} date={day.date} />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <span>少</span>
                {['bg-gray-100','bg-gray-300','bg-gray-500','bg-gray-700','bg-black'].map((c,i) => (
                  <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
                ))}
                <span>多</span>
              </div>
            </div>

            {/* Last 7 days list */}
            <div className="space-y-2">
              {heatmap.slice(-7).reverse().map(day => (
                <div key={day.date} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="text-xs text-gray-400 w-12 shrink-0">
                    {day.date.split('-').slice(1).join('/')}
                  </div>
                  {day.totalMinutes > 0 ? (
                    <>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-black h-full rounded-full"
                          style={{ width: `${Math.min(100, (day.totalMinutes / 180) * 100)}%` }}
                        />
                      </div>
                      <div className="text-xs font-medium w-16 text-right shrink-0">
                        {formatMinutes(day.totalMinutes)}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 text-xs text-gray-200">休息日</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
