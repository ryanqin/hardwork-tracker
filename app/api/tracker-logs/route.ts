import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { TrackerLog } from '../../types'

const DATA_FILE = path.join(process.cwd(), 'data', 'tracker-logs.json')

function ensure(): TrackerLog[] {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) { fs.writeFileSync(DATA_FILE, '[]'); return [] }
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) }
  catch { return [] }
}

function write(data: TrackerLog[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

export async function GET() {
  return NextResponse.json(ensure())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const logs = ensure()
  const newLog: TrackerLog = {
    ...body,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }
  logs.push(newLog)
  write(logs)
  return NextResponse.json(newLog)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  write(ensure().filter(l => l.id !== id))
  return NextResponse.json({ ok: true })
}
