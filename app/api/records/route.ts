import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_FILE = path.join(process.cwd(), 'data', 'records.json')

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]')
}

function readRecords() {
  ensureDataDir()
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function writeRecords(records: unknown[]) {
  ensureDataDir()
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2))
}

export async function GET() {
  return NextResponse.json(readRecords())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const records = readRecords()
  const newRecord = {
    ...body,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  }
  records.push(newRecord)
  writeRecords(records)
  return NextResponse.json(newRecord)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const records = readRecords().filter((r: { id: string }) => r.id !== id)
  writeRecords(records)
  return NextResponse.json({ ok: true })
}
