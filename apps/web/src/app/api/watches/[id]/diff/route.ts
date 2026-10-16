import { NextRequest, NextResponse } from 'next/server';
import { repo, getCurrentUserId } from '@/lib/server-state';
import { computeTextDiff } from '@pagepulse/core';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const searchParams = req.nextUrl.searchParams;
    const fromId = searchParams.get('from');
    const toId = searchParams.get('to');

    if (!fromId || !toId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Missing required query params "from" and "to"' } },
        { status: 400 }
      );
    }

    const fromSnap = await repo.getSnapshotById(fromId, userId);
    const toSnap = await repo.getSnapshotById(toId, userId);

    if (!fromSnap || !toSnap) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'One or both snapshots could not be found' } },
        { status: 404 }
      );
    }

    if (fromSnap.watchId !== id || toSnap.watchId !== id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Snapshots do not belong to the specified watch' } },
        { status: 403 }
      );
    }

    const textDiff = computeTextDiff(fromSnap.normalizedText, toSnap.normalizedText);

    return NextResponse.json({
      data: {
        watchId: id,
        fromSnapshot: {
          id: fromSnap.id,
          sequenceNo: fromSnap.sequenceNo,
          createdAt: fromSnap.createdAt,
          contentHash: fromSnap.contentHash,
        },
        toSnapshot: {
          id: toSnap.id,
          sequenceNo: toSnap.sequenceNo,
          createdAt: toSnap.createdAt,
          contentHash: toSnap.contentHash,
        },
        diff: textDiff,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
