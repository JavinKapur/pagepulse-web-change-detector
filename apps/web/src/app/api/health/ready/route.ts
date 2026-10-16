import { NextResponse } from 'next/server';
import { repo } from '@/lib/server-state';

export async function GET() {
  try {
    // Verify repository responsiveness
    await repo.findDueWatches(new Date(), 1);
    return NextResponse.json({
      status: 'ready',
      database: 'connected',
      storage: 'operational',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: (err as Error).message,
      },
      { status: 503 }
    );
  }
}
