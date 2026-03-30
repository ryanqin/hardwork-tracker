'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { WorkRecord, Category } from './types'
import {
  getRecords, saveRecord, deleteRecord,
  getTodayStats, getStreak, getLast30DaysStats,
  formatMinutes, CATEGORY_EMOJI, getToday,
} from './lib'

const TrackerPanel = dynamic(() => import('./components/TrackerPanel'), { ssr: false })

const CATEGORIES: Category[] = ['编程', '学习', '健身', '写作', '其他']

function HeatmapCell({ minutes, date }: { minutes: number; date: string }) {
  const intensity = minutes === 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4
  const bg = ['bg-gray-100','bg-gray-300','bg-gray-500','bg-gray-700','bg-black'][intensity]
  return (
    <div title={`${date.slice(5)}: ${minutes > 0 ? formatMinutes(minutes) : '无记录'}`}
      className={`w-6 h-6 rounded-sm ${bg} cursor-default transition-transform hover:scale-110`} />
  )
}

export default function Home() {
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<Category>('编程')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [histTab, setHistTab] = useState<'today' | 'history'>('today')

  const refresh = useCallback(async () => {
    setLoading(true)
    try { setRecords(await getRecords()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const todayStats = getTodayStats(records)
  const streak = getStreak(records)
  const heatmap = getLast30DaysStats(records)
  const today = getToday()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const mins = parseInt(minutes)
    if (!mins || mins <= 0) return
    setSaving(true)
    try {
      const r = await saveRecord({ date: today, category, minutes: mins, note: note.trim() || undefined })
      setRecords(prev => [...prev, r])
      setMinutes('')
      setNote('')
      setLogOpen(false)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    await deleteRecord(id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  const categoryStats = CATEGORIES.map(cat => ({
    cat,
    minutes: todayStats.records.filter(r => r.category === cat).reduce((s, r) => s + r.minutes, 0),
  })).filter(s => s.minutes > 0)

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">苦功夫</h1>
            <p className="text-gray-400 text-sm mt-0.5">每一分钟都算数</p>
          </div>
          {/* Top stats */}
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-2xl font-black leading-none">
                {loading ? '—' : formatMinutes(todayStats.totalMinutes)}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">今日时间</div>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div>
              <div className="text-2xl font-black leading-none">{streak.current}</div>
              <div className="text-xs text-gray-400 mt-0.5">连续天</div>
            </div>
          </div>
        </div>

        {/* Two-column layout on desktop */}
        <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 space-y-8 lg:space-y-0">

          {/* LEFT: Trackers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-gray-700">追踪器</div>
            </div>
            <TrackerPanel />
          </div>

          {/* RIGHT: Time log + history */}
          <div>
            {/* Record time — collapsible secondary */}
            <div className="mb-5">
              <button
                onClick={() => setLogOpen(x => !x)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl hover:border-gray-400 transition-colors text-sm"
              >
                <span className="font-medium text-gray-600">⏱ 记录苦功夫时间</span>
                <span className="text-gray-300 text-xs">{logOpen ? '收起 ▲' : '展开 ▼'}</span>
              </button>

              {logOpen && (
                <form onSubmit={handleAdd} className="border border-t-0 border-gray-200 rounded-b-xl px-4 pb-4 pt-3 -mt-1">
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {CATEGORIES.map(cat => (
                      <button key={cat} type="button" onClick={() => setCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          category === cat ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {CATEGORY_EMOJI[cat]} {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                      placeholder="时长（分钟）" min={1} max={999} required
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black" />
                    <div className="flex gap-1">
                      {[25, 45, 60, 90].map(m => (
                        <button key={m} type="button" onClick={() => setMinutes(m.toString())}
                          className="px-2 py-1 text-xs bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">{m}</button>
                      ))}
                    </div>
                  </div>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder="备注（可选）"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-black" />
                  <button type="submit" disabled={saving || !minutes}
                    className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-bold hover:bg-gray-800 disabled:opacity-40 transition-colors">
                    {saving ? '保存中...' : '＋ 记录'}
                  </button>
                </form>
              )}
            </div>

            {/* Tabs: today / heatmap */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
              {(['today', 'history'] as const).map(t => (
                <button key={t} onClick={() => setHistTab(t)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                    histTab === t ? 'bg-white shadow-sm text-black' : 'text-gray-400'
                  }`}>
                  {t === 'today' ? '今日记录' : '热力图'}
                </button>
              ))}
            </div>

            {histTab === 'today' && (
              <div>
                {categoryStats.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {categoryStats.map(({ cat, minutes: m }) => (
                      <span key={cat} className="text-xs bg-gray-100 rounded-full px-3 py-1">
                        {CATEGORY_EMOJI[cat]} {cat} {formatMinutes(m)}
                      </span>
                    ))}
                  </div>
                )}
                {loading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
                ) : todayStats.records.length === 0 ? (
                  <div className="text-center py-10 text-gray-300">
                    <div className="text-3xl mb-2">🔥</div>
                    <div className="text-sm">暂无时间记录</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayStats.records.slice().reverse().map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 group">
                        <span className="text-lg">{CATEGORY_EMOJI[r.category]}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{r.category} · {formatMinutes(r.minutes)}</div>
                          {r.note && <div className="text-xs text-gray-400 truncate">{r.note}</div>}
                        </div>
                        <button onClick={() => handleDelete(r.id)}
                          className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs transition-colors">
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {histTab === 'history' && (
              <div>
                <div className="flex gap-1 flex-wrap mb-2">
                  {heatmap.map(day => <HeatmapCell key={day.date} minutes={day.totalMinutes} date={day.date} />)}
                </div>
                <div className="flex items-center gap-2 mb-4 text-xs text-gray-400">
                  <span>少</span>
                  {['bg-gray-100','bg-gray-300','bg-gray-500','bg-gray-700','bg-black'].map((c,i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-sm ${c}`} />
                  ))}
                  <span>多</span>
                </div>
                <div className="space-y-2">
                  {heatmap.slice(-7).reverse().map(day => (
                    <div key={day.date} className="flex items-center gap-3 py-1.5">
                      <div className="text-xs text-gray-400 w-10 shrink-0">{day.date.slice(5)}</div>
                      {day.totalMinutes > 0 ? (
                        <>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-black h-full rounded-full"
                              style={{ width: `${Math.min(100, (day.totalMinutes / 180) * 100)}%` }} />
                          </div>
                          <div className="text-xs font-medium w-16 text-right shrink-0">{formatMinutes(day.totalMinutes)}</div>
                        </>
                      ) : <div className="flex-1 text-xs text-gray-200">休息日</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
