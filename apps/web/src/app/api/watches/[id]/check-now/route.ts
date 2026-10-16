import { NextRequest, NextResponse } from 'next/server';
import { repo, worker, getCurrentUserId } from '@/lib/server-state';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const watch = await repo.getWatchById(id, userId);

    if (!watch) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Watch not found or unauthorized' } },
        { status: 404 }
      );
    }

    // Trigger capture in worker
    await worker.processTargetCapture(watch.targetId);

    const updatedWatch = await repo.getWatchById(id, userId);
    return NextResponse.json({
      success: true,
      data: updatedWatch,
      message: 'Manual check completed successfully',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
