import { NextResponse } from 'next/server';
import { examSetStore, sectionStore } from '@/lib/dataStore';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const set = await examSetStore.get(routeParams.id);
  if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const sections = await sectionStore.getBySet(set.id);
  return NextResponse.json({ ...set, sections });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const updated = await examSetStore.update(routeParams.id, name);
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const routeParams = await params;
  await examSetStore.remove(routeParams.id);
  return NextResponse.json({ success: true });
}
