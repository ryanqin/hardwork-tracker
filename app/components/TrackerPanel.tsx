'use client'

import { useState, useEffect, useRef } from 'react'
import { Tracker, TrackerLog, TrackerUnit, UNIT_LABELS } from '../types'
import {
  deleteTracker, createTracker,
  getToday, getTodayValue, getTrackerStreak, getLast30Days,
} from '../tracker-lib'

// ── Timer helpers ─────────────────────────────────────────────
interface TimerState { trackerId: string; startTime: number; elapsed: number; running: boolean }
const TIMER_KEY = (id: string) => `timer_${id}`
function loadTimer(id: string): TimerState | null {
  try { const r = localStorage.getItem(TIMER_KEY(id)); return r ? JSON.parse(r) : null } catch { return null }
}
function saveTimer(s: TimerState) { localStorage.setItem(TIMER_KEY(s.trackerId), JSON.stringify(s)) }
function clearTimer(id: string) { localStorage.removeItem(TIMER_KEY(id)) }
function getElapsed(s: TimerState) { return s.running ? s.elapsed + (Date.now() - s.startTime) : s.elapsed }
function formatTime(ms: number) {
  const t = Math.floor(ms / 1000)
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function ProgressRing({ pct, running, size = 40 }: { pct: number; running?: boolean; size?: number }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={running ? '#16a34a' : 'black'} strokeWidth={4}
        strokeDasharray={`${Math.min(pct,1)*circ} ${circ}`} strokeLinecap="round" />
    </svg>
  )
}

function TrackerCard({ tracker, logs, onLog, onDelete }: {
  tracker: Tracker; logs: TrackerLog[]
  onLog: (id: string, v: number, note?: string) => Promise<void>
  onDelete: (id: string) => void
}) {
  const today = getToday()
  const todayVal = getTodayValue(logs, tracker.id)
  const streak = getTrackerStreak(logs, tracker)
  const pct = tracker.dailyTarget > 0 ? todayVal / tracker.dailyTarget : 0
  const done = pct >= 1
  const hist = getLast30Days(logs, tracker.id).slice(-7).reverse()
  const todayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === today)

  const [open, setOpen] = useState(false)
  const [timer, setTimer] = useState<TimerState | null>(null)
  const [displayMs, setDisplayMs] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [logging, setLogging] = useState(false)
  const [showHist, setShowHist] = useState(false)
  const [finishDialog, setFinishDialog] = useState<{ ms: number } | null>(null)
  const [finishQty, setFinishQty] = useState('')

  useEffect(() => {
    const reload = () => {
      const saved = loadTimer(tracker.id)
      if (saved) { setTimer(saved); setDisplayMs(getElapsed(saved)) }
      else { setTimer(null); setDisplayMs(0) }
    }
    reload()
    window.addEventListener('timer-change', reload)
    return () => window.removeEventListener('timer-change', reload)
  }, [tracker.id])

  useEffect(() => {
    if (timer?.running) { tickRef.current = setInterval(() => setDisplayMs(getElapsed(timer)), 1000) }
    else { if (tickRef.current) clearInterval(tickRef.current) }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [timer])

  function handleStart() {
    const s: TimerState = { trackerId: tracker.id, startTime: Date.now(), elapsed: timer?.elapsed ?? 0, running: true }
    saveTimer(s); setTimer(s); setDisplayMs(getElapsed(s))
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }
  function handlePause() {
    if (!timer) return
    const s = { ...timer, elapsed: getElapsed(timer), running: false }
    saveTimer(s); setTimer(s); setDisplayMs(s.elapsed)
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }
  async function handleFinish() {
    if (!timer) return
    const ms = getElapsed(timer)
    clearTimer(tracker.id); setTimer(null); setDisplayMs(0)
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
    if (tracker.unit === 'minutes') {
      setLogging(true); await onLog(tracker.id, Math.max(1, Math.round(ms / 60000)), `计时 ${formatTime(ms)}`); setLogging(false)
    } else { setFinishDialog({ ms }) }
  }
  async function handleFinishConfirm(e: React.FormEvent) {
    e.preventDefault(); if (!finishDialog) return
    setLogging(true)
    await onLog(tracker.id, parseInt(finishQty) || 0, `计时 ${formatTime(finishDialog.ms)}`)
    setFinishDialog(null); setFinishQty(''); setLogging(false)
  }
  async function handleManualLog(e: React.FormEvent) {
    e.preventDefault(); const v = parseInt(manualInput); if (!v || v <= 0) return
    setLogging(true); await onLog(tracker.id, v, manualNote.trim() || undefined)
    setManualInput(''); setManualNote(''); setLogging(false)
  }

  const isRunning = timer?.running ?? false
  const isPaused = !!(timer && !timer.running && timer.elapsed > 0)

  return (
    <div className={`border rounded-xl transition-colors ${done ? 'border-black' : isRunning ? 'border-green-400' : 'border-gray-200'}`}>
      <button onClick={() => setOpen(x => !x)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <div className="relative flex items-center justify-center shrink-0">
          <ProgressRing pct={pct} running={isRunning} />
          <span className="absolute text-base">{tracker.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{tracker.name}</div>
          <div className="text-xs text-gray-400">
            {todayVal}/{tracker.dailyTarget} {UNIT_LABELS[tracker.unit]}{done && ' ✅'}
            {isRunning && <span className="ml-1 text-green-500 font-mono">{formatTime(displayMs)} ●</span>}
            {isPaused && <span className="ml-1 text-yellow-500 font-mono">{formatTime(displayMs)} ⏸</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-base font-black leading-none">{streak}</div>
            <div className="text-xs text-gray-300">streak</div>
          </div>
          <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div className={`rounded-xl px-4 py-2.5 flex items-center justify-between ${isRunning ? 'bg-green-50' : isPaused ? 'bg-yellow-50' : 'bg-gray-50'}`}>
            <span className={`font-mono text-2xl font-bold tracking-wider ${isRunning ? 'text-green-700' : isPaused ? 'text-yellow-700' : 'text-gray-300'}`}>
              {displayMs > 0 ? formatTime(displayMs) : '00:00'}
            </span>
            <div className="flex gap-2">
              {!isRunning && (
                <button onClick={handleStart}
                  className="px-3 py-1.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                  {isPaused ? '▶ 继续' : '▶ 开始'}
                </button>
              )}
              {isRunning && (
                <button onClick={handlePause}
                  className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium">⏸ 暂停</button>
              )}
              {(isRunning || isPaused) && (
                <button onClick={handleFinish} disabled={logging}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium disabled:opacity-40">⏹ 结束</button>
              )}
            </div>
          </div>

          {finishDialog && (
            <form onSubmit={handleFinishConfirm} className="border border-dashed border-gray-300 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-2">计时 {formatTime(finishDialog.ms)}，完成了多少 {UNIT_LABELS[tracker.unit]}？</div>
              <div className="flex gap-2">
                <input type="number" value={finishQty} onChange={e => setFinishQty(e.target.value)}
                  placeholder={`${UNIT_LABELS[tracker.unit]}数`} min={0} step={1}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-black" />
                <button type="submit" disabled={logging} className="px-3 py-1.5 bg-black text-white rounded-lg text-sm">确认</button>
                <button type="button" onClick={() => setFinishDialog(null)}
                  className="px-3 py-1.5 text-gray-400 border border-gray-200 rounded-lg text-sm">取消</button>
              </div>
            </form>
          )}

          <form onSubmit={handleManualLog} className="flex gap-2">
            <input type="number" value={manualInput} onChange={e => setManualInput(e.target.value)}
              placeholder={`手动 + ${UNIT_LABELS[tracker.unit]}`} min={1} step={1}
              className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black text-gray-500" />
            <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="备注"
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black" />
            <button type="submit" disabled={logging || !manualInput}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-200">记</button>
          </form>

          {todayLogs.length > 0 && (
            <div className="space-y-0.5">
              {todayLogs.map(l => (
                <div key={l.id} className="text-xs text-gray-400">
                  {l.value > 0 ? `+${l.value} ${UNIT_LABELS[tracker.unit]}` : ''}{l.note ? ` · ${l.note}` : ''}
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setShowHist(x => !x)} className="text-xs text-gray-300 hover:text-gray-500">
            {showHist ? '收起历史' : '近7天 ▾'}
          </button>
          {showHist && (
            <div className="space-y-1">
              {hist.map(({ date, value }) => (
                <div key={date} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10 shrink-0">{date.slice(5)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-black h-full rounded-full"
                      style={{ width: `${Math.min(100, tracker.dailyTarget > 0 ? (value/tracker.dailyTarget)*100 : 0)}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-14 text-right shrink-0">
                    {value > 0 ? `${value}${UNIT_LABELS[tracker.unit]}` : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => onDelete(tracker.id)} className="text-xs text-gray-200 hover:text-red-400 transition-colors">删除追踪器</button>
        </div>
      )}
    </div>
  )
}

const UNITS: { value: TrackerUnit; label: string }[] = [
  { value: 'minutes', label: '分钟' }, { value: 'pages', label: '页' },
  { value: 'problems', label: '题' }, { value: 'times', label: '次' },
]

export default function TrackerPanel({ trackers, logs, onLog, onDelete, onTrackerCreated }: {
  trackers: Tracker[]
  logs: TrackerLog[]
  onLog: (id: string, v: number, note?: string) => Promise<void>
  onDelete: (id: string) => void
  onTrackerCreated: (t: Tracker) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('🎯')
  const [newUnit, setNewUnit] = useState<TrackerUnit>('minutes')
  const [newTarget, setNewTarget] = useState('')

  const sorted = [...trackers].sort((a, b) => {
    const pa = getTodayValue(logs, a.id) / (a.dailyTarget || 1)
    const pb = getTodayValue(logs, b.id) / (b.dailyTarget || 1)
    const da = pa >= 1 ? 1 : 0, db = pb >= 1 ? 1 : 0
    if (da !== db) return da - db
    if (da === 0) return pb - pa
    return 0
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const t = await createTracker({ name: newName.trim(), emoji: newEmoji, unit: newUnit, dailyTarget: parseInt(newTarget) || 1 })
    onTrackerCreated(t)
    setNewName(''); setNewEmoji('🎯'); setNewTarget(''); setAdding(false)
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {sorted.map(t => (
          <TrackerCard key={t.id} tracker={t} logs={logs} onLog={onLog} onDelete={onDelete} />
        ))}
        {trackers.length === 0 && !adding && (
          <div className="text-center py-8 text-gray-300 text-sm">还没有追踪器</div>
        )}
      </div>
      <div className="pt-3 shrink-0">
        {adding ? (
          <form onSubmit={handleCreate} className="border border-dashed border-gray-300 rounded-xl p-4">
            <div className="text-sm font-bold mb-3">新建追踪器</div>
            <div className="flex gap-2 mb-2">
              <input value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
                className="w-12 text-center border border-gray-200 rounded-lg py-2 text-lg" maxLength={2} />
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="名称" required
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black" />
            </div>
            <div className="flex gap-2 mb-3">
              <select value={newUnit} onChange={e => setNewUnit(e.target.value as TrackerUnit)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-black">
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
              <input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="每日目标"
                type="number" min={1} step={1}
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
            className="w-full border border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-gray-400 transition-colors">
            ＋ 新建追踪器
          </button>
        )}
      </div>
    </div>
  )
}
