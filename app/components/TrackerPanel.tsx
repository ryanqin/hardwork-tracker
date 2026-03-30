'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tracker, TrackerLog, TrackerUnit, UNIT_LABELS } from '../types'
import {
  getTrackers, createTracker, deleteTracker,
  getTrackerLogs, addTrackerLog,
  getToday, getTodayValue, getTrackerStreak, getLast30Days,
} from '../tracker-lib'

// ── Timer state (localStorage) ───────────────────────────────
interface TimerState {
  trackerId: string
  startTime: number   // timestamp when last resumed
  elapsed: number     // ms accumulated before current run
  running: boolean
}

const TIMER_KEY = (id: string) => `timer_${id}`

function loadTimer(id: string): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY(id))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveTimer(state: TimerState) {
  localStorage.setItem(TIMER_KEY(state.trackerId), JSON.stringify(state))
}

function clearTimer(id: string) {
  localStorage.removeItem(TIMER_KEY(id))
}

function getElapsed(state: TimerState): number {
  if (!state.running) return state.elapsed
  return state.elapsed + (Date.now() - state.startTime)
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ── Progress ring ────────────────────────────────────────────
function ProgressRing({ pct, running }: { pct: number; running?: boolean }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const filled = Math.min(pct, 1) * circ
  return (
    <svg width={52} height={52} className="-rotate-90">
      <circle cx={26} cy={26} r={r} fill="none" stroke="#f3f4f6" strokeWidth={4} />
      <circle cx={26} cy={26} r={r} fill="none"
        stroke={running ? '#16a34a' : 'black'} strokeWidth={4}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        className={running ? 'transition-all duration-1000' : ''} />
    </svg>
  )
}

// ── TrackerCard ──────────────────────────────────────────────
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
  const hist = getLast30Days(logs, tracker.id).slice(-7).reverse()
  const todayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === today)

  // Timer state
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [displayMs, setDisplayMs] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Manual log
  const [manualInput, setManualInput] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Finish dialog (for non-minutes units)
  const [finishDialog, setFinishDialog] = useState<{ ms: number } | null>(null)
  const [finishQty, setFinishQty] = useState('')

  // Load timer from localStorage on mount
  useEffect(() => {
    const saved = loadTimer(tracker.id)
    if (saved) {
      setTimer(saved)
      setDisplayMs(getElapsed(saved))
    }
  }, [tracker.id])

  // Tick
  useEffect(() => {
    if (timer?.running) {
      tickRef.current = setInterval(() => {
        setDisplayMs(getElapsed(timer))
      }, 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [timer])

  function handleStart() {
    const state: TimerState = {
      trackerId: tracker.id,
      startTime: Date.now(),
      elapsed: timer?.elapsed ?? 0,
      running: true,
    }
    saveTimer(state)
    setTimer(state)
    setDisplayMs(getElapsed(state))
  }

  function handlePause() {
    if (!timer) return
    const state: TimerState = {
      ...timer,
      elapsed: getElapsed(timer),
      running: false,
    }
    saveTimer(state)
    setTimer(state)
    setDisplayMs(state.elapsed)
  }

  async function handleFinish() {
    if (!timer) return
    const ms = getElapsed(timer)
    clearTimer(tracker.id)
    setTimer(null)
    setDisplayMs(0)

    if (tracker.unit === 'minutes') {
      const mins = Math.max(1, Math.round(ms / 60000))
      setLogging(true)
      await onLog(tracker.id, mins, `计时 ${formatTime(ms)}`)
      setLogging(false)
    } else {
      // Ask how many units completed
      setFinishDialog({ ms })
    }
  }

  async function handleFinishConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (!finishDialog) return
    const qty = parseInt(finishQty)
    const mins = Math.max(1, Math.round(finishDialog.ms / 60000))
    setLogging(true)
    if (qty > 0) {
      await onLog(tracker.id, qty, `计时 ${formatTime(finishDialog.ms)}`)
    } else {
      // Just log time as note, 1 time as placeholder
      await onLog(tracker.id, 0, `计时 ${formatTime(finishDialog.ms)}（未记录完成量）`)
    }
    setFinishDialog(null)
    setFinishQty('')
    setLogging(false)
  }

  async function handleManualLog(e: React.FormEvent) {
    e.preventDefault()
    const v = parseInt(manualInput)
    if (!v || v <= 0) return
    setLogging(true)
    await onLog(tracker.id, v, manualNote.trim() || undefined)
    setManualInput('')
    setManualNote('')
    setLogging(false)
  }

  const isRunning = timer?.running ?? false
  const isPaused = timer && !timer.running && timer.elapsed > 0
  const isIdle = !timer || (!timer.running && !timer.elapsed)

  return (
    <div className={`border rounded-2xl p-4 transition-colors ${
      done ? 'border-black bg-gray-50' : isRunning ? 'border-green-400' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <ProgressRing pct={pct} running={isRunning} />
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

      {/* Timer display */}
      <div className={`mt-3 rounded-xl px-4 py-2.5 flex items-center justify-between ${
        isRunning ? 'bg-green-50' : isPaused ? 'bg-yellow-50' : 'bg-gray-50'
      }`}>
        <span className={`font-mono text-2xl font-bold tracking-wider ${
          isRunning ? 'text-green-700' : isPaused ? 'text-yellow-700' : 'text-gray-300'
        }`}>
          {displayMs > 0 ? formatTime(displayMs) : '00:00'}
        </span>
        <div className="flex gap-2">
          {(isIdle || isPaused) && (
            <button onClick={handleStart}
              className="px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">
              {isPaused ? '▶ 继续' : '▶ 开始'}
            </button>
          )}
          {isRunning && (
            <button onClick={handlePause}
              className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium hover:bg-yellow-200">
              ⏸ 暂停
            </button>
          )}
          {(isRunning || isPaused) && (
            <button onClick={handleFinish} disabled={logging}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40">
              ⏹ 结束
            </button>
          )}
        </div>
      </div>

      {/* Finish dialog for non-minutes units */}
      {finishDialog && (
        <form onSubmit={handleFinishConfirm}
          className="mt-2 border border-dashed border-gray-300 rounded-xl p-3 bg-white">
          <div className="text-xs text-gray-500 mb-2">
            计时 {formatTime(finishDialog.ms)}，完成了多少 {UNIT_LABELS[tracker.unit]}？
          </div>
          <div className="flex gap-2">
            <input type="number" value={finishQty} onChange={e => setFinishQty(e.target.value)}
              placeholder={`${UNIT_LABELS[tracker.unit]}数`} min={0} step={1}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-black" />
            <button type="submit" disabled={logging}
              className="px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-40">
              确认
            </button>
            <button type="button" onClick={() => setFinishDialog(null)}
              className="px-3 py-1.5 text-gray-400 border border-gray-200 rounded-lg text-sm">
              取消
            </button>
          </div>
        </form>
      )}

      {/* Manual log */}
      <form onSubmit={handleManualLog} className="mt-2 flex gap-2">
        <input type="number" value={manualInput} onChange={e => setManualInput(e.target.value)}
          placeholder={`手动 + ${UNIT_LABELS[tracker.unit]}`} min={1} step={1}
          className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black text-gray-500" />
        <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)}
          placeholder="备注"
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black" />
        <button type="submit" disabled={logging || !manualInput}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-200">
          记
        </button>
      </form>

      {/* Today's logs */}
      {todayLogs.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {todayLogs.map(l => (
            <div key={l.id} className="text-xs text-gray-400">
              {l.value > 0 ? `+${l.value} ${UNIT_LABELS[tracker.unit]}` : ''}
              {l.note ? ` · ${l.note}` : ''}
            </div>
          ))}
        </div>
      )}

      {/* History */}
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

// ── Create form ──────────────────────────────────────────────
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
      dailyTarget: parseInt(newTarget) || 1,
    })
    setTrackers(prev => [...prev, t])
    setNewName('')
    setNewEmoji('🎯')
    setNewTarget('')
    setAdding(false)
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2].map(i => <div key={i} className="h-40 bg-gray-50 rounded-2xl animate-pulse" />)}
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
              placeholder="每日目标" type="number" min={1} step={1}
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
