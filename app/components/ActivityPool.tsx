'use client'

import { useState, useEffect, useRef } from 'react'
import { Tracker, TrackerLog, UNIT_LABELS } from '../types'
import { getToday, getTodayValue, getTrackerStreak } from '../tracker-lib'

interface TimerState {
  trackerId: string
  startTime: number
  elapsed: number
  running: boolean
}

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

type TimerStatus = 'idle' | 'running' | 'paused'

function Capsule({ tracker, logs, onLog }: {
  tracker: Tracker
  logs: TrackerLog[]
  onLog: (trackerId: string, value: number, note?: string) => Promise<void>
}) {
  const done = getTodayValue(logs, tracker.id) >= tracker.dailyTarget
  const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle')
  const [displayMs, setDisplayMs] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    const saved = loadTimer(tracker.id)
    if (saved) {
      setTimerStatus(saved.running ? 'running' : 'paused')
      setDisplayMs(getElapsed(saved))
    }
  }, [tracker.id])

  useEffect(() => {
    if (timerStatus === 'running') {
      const t = loadTimer(tracker.id)
      tickRef.current = setInterval(() => { if (t) setDisplayMs(getElapsed(t)) }, 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [timerStatus, tracker.id])

  function handleStart() {
    const existing = loadTimer(tracker.id)
    const s: TimerState = {
      trackerId: tracker.id,
      startTime: Date.now(),
      elapsed: existing?.elapsed ?? 0,
      running: true,
    }
    saveTimer(s)
    setTimerStatus('running')
    setDisplayMs(getElapsed(s))
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }

  async function handleStop() {
    const saved = loadTimer(tracker.id)
    if (!saved) return
    const ms = getElapsed(saved)
    clearTimer(tracker.id)
    setTimerStatus('idle')
    setDisplayMs(0)
    setLogging(true)
    const mins = Math.max(1, Math.round(ms / 60000))
    if (tracker.unit === 'minutes') {
      await onLog(tracker.id, mins, `计时 ${formatTime(ms)}`)
    } else {
      await onLog(tracker.id, 1, `计时 ${formatTime(ms)}`)
    }
    setLogging(false)
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }

  // Colors by state
  const styles = done
    ? 'bg-gray-900 border-gray-900 text-white opacity-60'
    : timerStatus === 'running'
    ? 'bg-green-50 border-green-400 text-green-800 shadow-sm shadow-green-100'
    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${styles}`}>
      <span className="text-base leading-none">{tracker.emoji}</span>

      {timerStatus === 'running' && (
        <span className="font-mono text-xs font-semibold tabular-nums">{formatTime(displayMs)}</span>
      )}

      {!done && (
        timerStatus === 'running' ? (
          <button onClick={handleStop} disabled={logging}
            className="text-xs font-bold text-green-700 hover:text-green-900 disabled:opacity-40 leading-none">
            结束
          </button>
        ) : (
          <button onClick={handleStart}
            className="text-xs font-bold text-gray-500 hover:text-black leading-none">
            开始
          </button>
        )
      )}

      {done && <span className="text-xs font-bold">✓</span>}
    </div>
  )
}

export default function ActivityPool({ trackers, logs, onLog }: {
  trackers: Tracker[]
  logs: TrackerLog[]
  onLog: (trackerId: string, value: number, note?: string) => Promise<void>
}) {
  if (trackers.length === 0) return null

  // Sort: running first, then idle, then done
  const sorted = [...trackers].sort((a, b) => {
    const ta = loadTimer(a.id)
    const tb = loadTimer(b.id)
    const ra = ta?.running ? 2 : ta?.elapsed ? 1 : 0
    const rb = tb?.running ? 2 : tb?.elapsed ? 1 : 0
    const da = getTodayValue(logs, a.id) >= a.dailyTarget ? -1 : 0
    const db = getTodayValue(logs, b.id) >= b.dailyTarget ? -1 : 0
    return (rb + db) - (ra + da)
  })

  return (
    <div className="mb-5">
      <div className="text-xs text-gray-400 font-medium mb-2">活动池</div>
      <div className="flex flex-wrap gap-2">
        {sorted.map(t => (
          <Capsule key={t.id} tracker={t} logs={logs} onLog={onLog} />
        ))}
      </div>
    </div>
  )
}
