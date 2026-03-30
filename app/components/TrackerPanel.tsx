'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tracker, TrackerLog, TrackerUnit, UNIT_LABELS } from '../types'
import {
  getTrackers, createTracker, deleteTracker,
  getTrackerLogs, addTrackerLog,
  getToday, getTodayValue, getTrackerStreak, getLast30Days,
} from '../tracker-lib'

function ProgressRing({ pct }: { pct: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const filled = Math.min(pct, 1) * circ
  return (
    <svg width={52} height={52} className="-rotate-90">
      <circle cx={26} cy={26} r={r} fill="none" stroke="#f3f4f6" strokeWidth={4} />
      <circle cx={26} cy={26} r={r} fill="none" stroke="black" strokeWidth={4}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

function TrackerCard({
  tracker, logs, onLog, onDelete,
}: {
  tracker: Tracker
  logs: TrackerLog[]
  onLog: (trackerId: string, value: number, note?: string) => Promise<void>
  onDelete: (id: string) => void
}) {
  const today = getToday()
  const todayVal = getTodayValue(logs, tracker.id)
  const streak = getTrackerStreak(logs, tracker)
  const pct = tracker.dailyTarget > 0 ? todayVal / tracker.dailyTarget : 0
  const done = pct >= 1
  const [input, setInput] = useState('')
  const [note, setNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const hist = getLast30Days(logs, tracker.id).slice(-7).reverse()
  const todayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === today)

  async function handleLog(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(input)
    if (!v || v <= 0) return
    setLogging(true)
    await onLog(tracker.id, v, note.trim() || undefined)
    setInput('')
    setNote('')
    setLogging(false)
  }

  return (
    <div className={`border rounded-2xl p-4 transition-colors ${done ? 'border-black bg-gray-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <ProgressRing pct={pct} />
          <span className="absolute text-xl">{tracker.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{tracker.name}</div>
          <div className="text-xs text-gray-400">
            {todayVal} / {tracker.dailyTarget} {UNIT_LABELS[tracker.unit]}
            {done && ' ✅'}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-black">{streak}</div>
          <div className="text-xs text-gray-300">streak</div>
        </div>
      </div>

      <form onSubmit={handleLog} className="mt-3 flex gap-2">
        <input type="number" value={input} onChange={e => setInput(e.target.value)}
          placeholder={`+ ${UNIT_LABELS[tracker.unit]}`} min={0.1} step={0.1}
          className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black" />
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder="备注"
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black" />
        <button type="submit" disabled={logging || !input}
          className="px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-40">
          记
        </button>
      </form>

      {todayLogs.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {todayLogs.map(l => (
            <div key={l.id} className="text-xs text-gray-400">
              +{l.value} {UNIT_LABELS[tracker.unit]}{l.note ? ` · ${l.note}` : ''}
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setExpanded(x => !x)} className="mt-2 text-xs text-gray-300 hover:text-gray-500">
        {expanded ? '收起' : '近7天 ▾'}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {hist.map(({ date, value }) => (
            <div key={date} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-10 shrink-0">{date.slice(5)}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-black h-full rounded-full"
                  style={{ width: `${Math.min(100, tracker.dailyTarget > 0 ? (value / tracker.dailyTarget) * 100 : 0)}%` }} />
              </div>
              <span className="text-xs text-gray-400 w-14 text-right shrink-0">
                {value > 0 ? `${value}${UNIT_LABELS[tracker.unit]}` : '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => onDelete(tracker.id)}
        className="mt-2 text-xs text-gray-200 hover:text-red-400 transition-colors">
        删除追踪器
      </button>
    </div>
  )
}

const UNITS: { value: TrackerUnit; label: string }[] = [
  { value: 'minutes', label: '分钟' },
  { value: 'pages', label: '页' },
  { value: 'problems', label: '题' },
  { value: 'times', label: '次' },
]

export default function TrackerPanel() {
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [logs, setLogs] = useState<TrackerLog[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🎯')
  const [newUnit, setNewUnit] = useState<TrackerUnit>('minutes')
  const [newTarget, setNewTarget] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const [t, l] = await Promise.all([getTrackers(), getTrackerLogs()])
    setTrackers(t)
    setLogs(l)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleLog(trackerId: string, value: number, note?: string) {
    const log = await addTrackerLog({ trackerId, date: getToday(), value, note })
    setLogs(prev => [...prev, log])
  }

  async function handleDelete(id: string) {
    await deleteTracker(id)
    setTrackers(prev => prev.filter(t => t.id !== id))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const t = await createTracker({
      name: newName.trim(),
      emoji: newEmoji,
      unit: newUnit,
      dailyTarget: parseFloat(newTarget) || 1,
    })
    setTrackers(prev => [...prev, t])
    setNewName('')
    setNewEmoji('🎯')
    setNewTarget('')
    setAdding(false)
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2].map(i => <div key={i} className="h-32 bg-gray-50 rounded-2xl animate-pulse" />)}
    </div>
  )

  return (
    <div>
      <div className="space-y-3 mb-4">
        {trackers.map(t => (
          <TrackerCard key={t.id} tracker={t} logs={logs} onLog={handleLog} onDelete={handleDelete} />
        ))}
        {trackers.length === 0 && !adding && (
          <div className="text-center py-8 text-gray-300 text-sm">还没有追踪器</div>
        )}
      </div>

      {adding ? (
        <form onSubmit={handleCreate} className="border border-dashed border-gray-300 rounded-2xl p-4">
          <div className="text-sm font-bold mb-3">新建追踪器</div>
          <div className="flex gap-2 mb-2">
            <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
              className="w-12 text-center border border-gray-200 rounded-lg py-2 focus:outline-none focus:border-black text-lg"
              maxLength={2} />
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="名称" required
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>
          <div className="flex gap-2 mb-3">
            <select value={newUnit} onChange={e => setNewUnit(e.target.value as TrackerUnit)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black">
              {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <input value={newTarget} onChange={e => setNewTarget(e.target.value)}
              placeholder="每日目标" type="number" min={0.1} step={0.1}
              className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-black text-white rounded-lg py-2 text-sm font-bold">创建</button>
            <button type="button" onClick={() => setAdding(false)}
              className="px-4 py-2 text-sm text-gray-400 border border-gray-200 rounded-lg">取消</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full border border-dashed border-gray-200 rounded-2xl py-3 text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
          ＋ 新建追踪器
        </button>
      )}
    </div>
  )
}
