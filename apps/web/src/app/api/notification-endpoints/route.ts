import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { repo, encryptionKey, getCurrentUserId } from '@/lib/server-state';
import { encryptSecret, decryptSecret } from '@pagepulse/db';

const CreateEndpointSchema = z.object({
  channel: z.enum(['email', 'telegram', 'discord']),
  config: z.record(z.any()),
  enabled: z.boolean().default(true),
});

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const endpoints = await repo.listNotificationEndpoints(userId);

    // Mask secrets before sending to client
    const masked = endpoints.map((ep) => {
      let preview = '';
      try {
        const config = decryptSecret<Record<string, any>>(ep.encryptedConfig, encryptionKey);
        if (ep.channel === 'email') preview = config.email || config.recipient || '';
        if (ep.channel === 'discord') {
          const url = String(config.webhookUrl || '');
          preview = url.length > 20 ? `${url.slice(0, 32)}...` : url;
        }
        if (ep.channel === 'telegram') preview = `Chat: ${config.chatId || ''}`;
      } catch {
        preview = 'Encrypted';
      }

      return {
        id: ep.id,
        channel: ep.channel,
        preview,
        enabled: ep.enabled,
        createdAt: ep.createdAt,
      };
    });

    return NextResponse.json({ data: masked });
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
    const parsed = CreateEndpointSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join(', ') } },
        { status: 400 }
      );
    }

    const { channel, config, enabled } = parsed.data;

    // Encrypt configuration at rest
    const encryptedConfig = encryptSecret(config, encryptionKey);

    const endpoint = await repo.createNotificationEndpoint({
      userId,
      channel,
      encryptedConfig,
      enabled,
    });

    return NextResponse.json({
      data: {
        id: endpoint.id,
        channel: endpoint.channel,
        enabled: endpoint.enabled,
        createdAt: endpoint.createdAt,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: (err as Error).message } },
      { status: 500 }
    );
  }
}
