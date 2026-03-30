'use client'

import { useState, useEffect, useRef } from 'react'
import { Tracker, TrackerLog } from '../types'
import { getToday, getTodayValue } from '../tracker-lib'

interface TimerState {
  trackerId: string; startTime: number; elapsed: number; running: boolean
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

type TimerStatus = 'idle' | 'running'

function Capsule({ tracker, logs }: { tracker: Tracker; logs: TrackerLog[] }) {
  const done = getTodayValue(logs, tracker.id) >= tracker.dailyTarget
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [displayMs, setDisplayMs] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<TimerState | null>(null)

  useEffect(() => {
    const saved = loadTimer(tracker.id)
    if (saved?.running) {
      timerRef.current = saved
      setStatus('running')
      setDisplayMs(getElapsed(saved))
    }
    const onTimerChange = () => {
      const t = loadTimer(tracker.id)
      if (t?.running) { timerRef.current = t; setStatus('running'); setDisplayMs(getElapsed(t)) }
      else { timerRef.current = null; setStatus('idle'); setDisplayMs(0) }
    }
    window.addEventListener('timer-change', onTimerChange)
    return () => window.removeEventListener('timer-change', onTimerChange)
  }, [tracker.id])

  useEffect(() => {
    if (status === 'running') {
      tickRef.current = setInterval(() => {
        if (timerRef.current) setDisplayMs(getElapsed(timerRef.current))
      }, 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [status])

  function handleStart() {
    const existing = loadTimer(tracker.id)
    const s: TimerState = {
      trackerId: tracker.id, startTime: Date.now(),
      elapsed: existing?.elapsed ?? 0, running: true,
    }
    saveTimer(s)
    timerRef.current = s
    setStatus('running')
    setDisplayMs(getElapsed(s))
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }

  function handleStop() {
    // 只停止计时，不写入完成量
    clearTimer(tracker.id)
    timerRef.current = null
    setStatus('idle')
    setDisplayMs(0)
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }

  const styles = done
    ? 'bg-gray-900 border-gray-900 text-white opacity-60'
    : status === 'running'
    ? 'bg-green-50 border-green-400 text-green-800 shadow-sm shadow-green-100'
    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${styles}`}>
      <span className="text-base leading-none">{tracker.emoji}</span>
      {status === 'running' && (
        <span className="font-mono text-xs font-semibold tabular-nums">{formatTime(displayMs)}</span>
      )}
      {!done && (
        status === 'running' ? (
          <button onClick={handleStop}
            className="text-xs font-bold text-green-700 hover:text-green-900 leading-none">
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

export default function ActivityPool({ trackers, logs }: {
  trackers: Tracker[]
  logs: TrackerLog[]
}) {
  if (trackers.length === 0) return null

  const sorted = [...trackers].sort((a, b) => {
    const ta = loadTimer(a.id), tb = loadTimer(b.id)
    const ra = ta?.running ? 2 : 0
    const rb = tb?.running ? 2 : 0
    const da = getTodayValue(logs, a.id) >= a.dailyTarget ? -1 : 0
    const db = getTodayValue(logs, b.id) >= b.dailyTarget ? -1 : 0
    return (rb + db) - (ra + da)
  })

  return (
    <div className="mb-5">
      <div className="text-xs text-gray-400 font-medium mb-2">活动池</div>
      <div className="flex flex-wrap gap-2">
        {sorted.map(t => <Capsule key={t.id} tracker={t} logs={logs} />)}
      </div>
    </div>
  )
}
