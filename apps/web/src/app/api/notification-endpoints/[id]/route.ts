import { NextRequest, NextResponse } from 'next/server';
import { repo, getCurrentUserId } from '@/lib/server-state';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const deleted = await repo.deleteNotificationEndpoint(id, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Notification endpoint not found or unauthorized' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
