import { NextRequest, NextResponse } from 'next/server';
import { repo, getCurrentUserId } from '@/lib/server-state';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const snapshots = await repo.listSnapshotsForWatch(id, userId, 50);

    return NextResponse.json({ data: snapshots });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
