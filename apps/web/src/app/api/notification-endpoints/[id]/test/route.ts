import { NextRequest, NextResponse } from 'next/server';
import { repo, dispatcher, getCurrentUserId } from '@/lib/server-state';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const endpoint = await repo.getNotificationEndpoint(id, userId);

    if (!endpoint) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Notification endpoint not found' } },
        { status: 404 }
      );
    }

    const testPayload = {
      watchName: 'Test Watch',
      hostname: 'pagepulse.dev',
      targetUrl: 'https://pagepulse.dev',
      changeType: 'TEST' as const,
      timestamp: new Date(),
      changeSummary: 'This is a test notification from PagePulse to verify channel delivery.',
      diffUrl: 'https://pagepulse.dev',
    };

    const result = await dispatcher.sendTestNotification(endpoint, testPayload);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'DELIVERY_FAILED', message: result.error || 'Test delivery failed' } },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      providerMessageId: result.providerMessageId,
      message: 'Test notification sent successfully',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
