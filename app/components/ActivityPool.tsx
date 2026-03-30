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
function getElapsed(s: TimerState) { return s.running ? s.elapsed + (Date.now() - s.startTime) : s.elapsed }
function formatTime(ms: number) {
  const t = Math.floor(ms / 1000)
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <polygon points="2,1 11,6 2,11" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1.5" y="1" width="3.5" height="10" rx="1" />
      <rect x="7" y="1" width="3.5" height="10" rx="1" />
    </svg>
  )
}

function Capsule({ tracker, logs }: { tracker: Tracker; logs: TrackerLog[] }) {
  const done = getTodayValue(logs, tracker.id) >= tracker.dailyTarget
  const [running, setRunning] = useState(false)
  const [displayMs, setDisplayMs] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<TimerState | null>(null)

  useEffect(() => {
    const sync = () => {
      const t = loadTimer(tracker.id)
      timerRef.current = t
      setRunning(t?.running ?? false)
      setDisplayMs(t ? getElapsed(t) : 0)
    }
    sync()
    window.addEventListener('timer-change', sync)
    return () => window.removeEventListener('timer-change', sync)
  }, [tracker.id])

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        if (timerRef.current) setDisplayMs(getElapsed(timerRef.current))
      }, 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running])

  function toggle() {
    const current = loadTimer(tracker.id)
    if (running) {
      // Pause
      const s: TimerState = { trackerId: tracker.id, startTime: 0, elapsed: getElapsed(current!), running: false }
      saveTimer(s); timerRef.current = s; setRunning(false); setDisplayMs(s.elapsed)
    } else {
      // Start / Resume
      const s: TimerState = { trackerId: tracker.id, startTime: Date.now(), elapsed: current?.elapsed ?? 0, running: true }
      saveTimer(s); timerRef.current = s; setRunning(true); setDisplayMs(getElapsed(s))
    }
    window.dispatchEvent(new CustomEvent('timer-change', { detail: { trackerId: tracker.id } }))
  }

  const styles = done
    ? 'bg-gray-900 border-gray-900 text-white opacity-50'
    : running
    ? 'bg-green-50 border-green-400 text-green-800'
    : displayMs > 0
    ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'

  return (
    <div className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border transition-all ${styles}`}>
      <span className="text-sm leading-none">{tracker.emoji}</span>
      {(running || displayMs > 0) && (
        <span className="font-mono text-xs font-semibold tabular-nums">{formatTime(displayMs)}</span>
      )}
      {!done && (
        <button onClick={toggle}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            running
              ? 'bg-green-200 text-green-800 hover:bg-green-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}>
          {running ? <PauseIcon /> : <PlayIcon />}
        </button>
      )}
      {done && <span className="text-xs font-bold ml-0.5">✓</span>}
    </div>
  )
}

export default function ActivityPool({ trackers, logs }: {
  trackers: Tracker[]
  logs: TrackerLog[]
}) {
  if (trackers.length === 0) return null

  const sorted = [...trackers].sort((a, b) => {
    const ra = loadTimer(a.id)?.running ? 2 : 0
    const rb = loadTimer(b.id)?.running ? 2 : 0
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
