import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repo, getCurrentUserId } from '@/lib/server-state';

const UpdateWatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  intervalMinutes: z.coerce.number().min(15).max(1440).optional(),
  enabled: z.boolean().optional(),
  sensitivity: z.enum(['low', 'normal', 'high', 'custom']).optional(),
  includeSelectors: z.array(z.string()).optional(),
  ignoreSelectors: z.array(z.string()).optional(),
  normalizationRules: z.record(z.any()).optional(),
});

export async function GET(
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

    const target = await repo.getTargetById(watch.targetId);
    return NextResponse.json({
      data: {
        ...watch,
        targetUrl: target?.canonicalUrl || '',
        hostname: target?.hostname || '',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const body = await req.json();

    const parsed = UpdateWatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } },
        { status: 400 }
      );
    }

    const updated = await repo.updateWatch(id, userId, parsed.data as any);
    if (!updated) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Watch not found or unauthorized' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const deleted = await repo.deleteWatch(id, userId);

    if (!deleted) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Watch not found or unauthorized' } },
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
