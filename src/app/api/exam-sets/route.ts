import { NextResponse } from 'next/server';
import { examSetStore } from '@/lib/dataStore';

// GET /api/exam-sets – list all exam sets
export async function GET() {
  const sets = await examSetStore.all();
  return NextResponse.json(sets);
}

// POST /api/exam-sets – create a new set (body: { name })
export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  const newSet = await examSetStore.create(name);
  return NextResponse.json(newSet, { status: 201 });
}
