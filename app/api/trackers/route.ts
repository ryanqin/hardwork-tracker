import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Tracker } from '../../types'

const DATA_FILE = path.join(process.cwd(), 'data', 'trackers.json')

const DEFAULT_TRACKERS: Tracker[] = [
  {
    id: 'coding-practice',
    name: 'Coding Practice',
    emoji: '⌨️',
    unit: 'problems',
    dailyTarget: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'inference-engineering',
    name: 'Inference Engineering',
    emoji: '📖',
    unit: 'pages',
    dailyTarget: 20,
    createdAt: new Date().toISOString(),
  },
]

function ensure(): Tracker[] {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_TRACKERS, null, 2))
    return DEFAULT_TRACKERS
  }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) }
  catch { return DEFAULT_TRACKERS }
}

function write(data: Tracker[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

export async function GET() {
  return NextResponse.json(ensure())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trackers = ensure()
  const newTracker: Tracker = {
    ...body,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }
  trackers.push(newTracker)
  write(trackers)
  return NextResponse.json(newTracker)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  write(ensure().filter(t => t.id !== id))
  return NextResponse.json({ ok: true })
}
