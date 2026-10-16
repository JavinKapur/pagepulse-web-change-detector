import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repo, worker, getCurrentUserId } from '@/lib/server-state';
import { canonicalizeUrl, validateUrlSsrf, deriveTargetKey } from '@pagepulse/core';

const CreateWatchSchema = z.object({
  url: z.string().min(1),
  name: z.string().min(1).max(100),
  intervalMinutes: z.coerce.number().min(15).max(1440).default(60),
  sensitivity: z.enum(['low', 'normal', 'high', 'custom']).default('normal'),
  includeSelectors: z.array(z.string()).default([]),
  ignoreSelectors: z.array(z.string()).default([]),
  normalizationRules: z.record(z.any()).default({}),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const watches = await repo.listWatchesByUserId(userId);

    // Attach target URL and hostname to each watch
    const enrichedWatches = await Promise.all(
      watches.map(async (w) => {
        const target = await repo.getTargetById(w.targetId);
        return {
          ...w,
          targetUrl: target?.canonicalUrl || '',
          hostname: target?.hostname || '',
        };
      })
    );

    return NextResponse.json({ data: enrichedWatches });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = CreateWatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      );
    }

    const { url, name, intervalMinutes, sensitivity, includeSelectors, ignoreSelectors, normalizationRules } =
      parsed.data;

    // 1. URL Canonicalization
    let canonical;
    try {
      canonical = canonicalizeUrl(url);
    } catch (err: unknown) {
      return NextResponse.json(
        { error: { code: 'INVALID_URL', message: (err as Error).message } },
        { status: 400 }
      );
    }

    // 2. SSRF Check
    const ssrfCheck = validateUrlSsrf(canonical.canonicalUrl);
    if (!ssrfCheck.safe) {
      return NextResponse.json(
        { error: { code: 'SSRF_BLOCKED', message: ssrfCheck.reason } },
        { status: 400 }
      );
    }

    // 3. Find or Create Shared Target
    const targetKey = deriveTargetKey(canonical.canonicalUrl);
    const target = await repo.findOrCreateTarget(
      canonical.canonicalUrl,
      targetKey,
      canonical.hostname
    );

    // 4. Create Watch
    const watch = await repo.createWatch({
      userId,
      targetId: target.id,
      name,
      intervalMinutes,
      enabled: true,
      sensitivity,
      includeSelectors,
      ignoreSelectors,
      normalizationRules,
      status: 'UNKNOWN',
      nextCheckAt: new Date(Date.now() + intervalMinutes * 60 * 1000),
      baselineEstablishedAt: null,
      lastCheckedAt: null,
      lastChangedAt: null,
      lastErrorMessage: null,
    });

    // 5. Trigger initial baseline capture immediately
    worker.processTargetCapture(target.id).catch(console.error);

    return NextResponse.json({
      data: {
        ...watch,
        targetUrl: target.canonicalUrl,
        hostname: target.hostname,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
