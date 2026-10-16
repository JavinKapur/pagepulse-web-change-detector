'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  Mail,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';

interface NotificationEndpointItem {
  id: string;
  channel: 'email' | 'telegram' | 'discord';
  preview: string;
  enabled: boolean;
  createdAt: string;
}

export default function NotificationSettingsPage() {
  const [endpoints, setEndpoints] = useState<NotificationEndpointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Add form state
  const [channel, setChannel] = useState<'email' | 'telegram' | 'discord'>('email');
  const [emailValue, setEmailValue] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchEndpoints = async () => {
    try {
      const res = await fetch('/api/notification-endpoints');
      if (res.ok) {
        const json = await res.json();
        setEndpoints(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load endpoints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const handleTestEndpoint = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/notification-endpoints/${id}/test`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setTestResult({ id, success: true, message: json.message || 'Test alert delivered successfully!' });
      } else {
        setTestResult({ id, success: false, message: json.error?.message || 'Delivery failed' });
      }
    } catch (err: unknown) {
      setTestResult({ id, success: false, message: (err as Error).message });
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Remove this notification destination?')) return;
    try {
      const res = await fetch(`/api/notification-endpoints/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEndpoints((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleAddEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    const config: Record<string, string> = {};
    if (channel === 'email') {
      config.email = emailValue;
    } else if (channel === 'discord') {
      config.webhookUrl = discordWebhook;
    } else if (channel === 'telegram') {
      config.chatId = telegramChatId;
      if (telegramBotToken) config.botToken = telegramBotToken;
    }

    try {
      const res = await fetch('/api/notification-endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, config, enabled: true }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to add destination');
      }

      setEmailValue('');
      setDiscordWebhook('');
      setTelegramChatId('');
      setTelegramBotToken('');
      await fetchEndpoints();
    } catch (err: unknown) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alert Destinations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure where PagePulse delivers alerts when meaningful changes are detected. Secrets are encrypted at rest with AES-256-GCM.
        </p>
      </div>

      {/* Existing Endpoints List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Bell className="h-4 w-4 text-indigo-600" />
          <span>Configured Destinations ({endpoints.length})</span>
        </h2>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin" />
          </div>
        ) : endpoints.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No notification destinations configured yet. Add your first destination below.
          </div>
        ) : (
          <div className="grid gap-3">
            {endpoints.map((ep) => {
              const isTesting = testingId === ep.id;
              const result = testResult?.id === ep.id ? testResult : null;
              return (
                <div
                  key={ep.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                        {ep.channel === 'email' && <Mail className="h-4 w-4" />}
                        {ep.channel === 'telegram' && <Send className="h-4 w-4" />}
                        {ep.channel === 'discord' && <MessageSquare className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 capitalize">
                            {ep.channel} Destination
                          </span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            ACTIVE
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{ep.preview}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestEndpoint(ep.id)}
                        disabled={isTesting}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isTesting ? 'animate-spin text-indigo-600' : ''}`} />
                        <span>Send Test</span>
                      </button>

                      <button
                        onClick={() => handleDeleteEndpoint(ep.id)}
                        className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Remove endpoint"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {result && (
                    <div
                      className={`rounded-lg p-2.5 text-xs flex items-center gap-2 ${
                        result.success ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      )}
                      <span>{result.message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Destination Form */}
      <form
        onSubmit={handleAddEndpoint}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
      >
        <h2 className="text-sm font-semibold text-slate-900">Add Notification Destination</h2>

        {formError && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'email', label: 'Email', icon: Mail },
            { id: 'discord', label: 'Discord', icon: MessageSquare },
            { id: 'telegram', label: 'Telegram', icon: Send },
          ].map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setChannel(item.id as any)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 px-3 text-xs font-semibold transition-colors ${
                channel === item.id
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {channel === 'email' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="user@example.com"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {channel === 'discord' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Discord Webhook URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://discord.com/api/webhooks/123456789/token..."
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
              className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {channel === 'telegram' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Telegram Chat ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 123456789 or @channelname"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Bot Token (Optional if shared bot configured)
              </label>
              <input
                type="password"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{submitting ? 'Adding...' : 'Add Destination'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
