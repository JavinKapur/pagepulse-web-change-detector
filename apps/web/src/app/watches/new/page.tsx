'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Globe,
  Sliders,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { WATCH_INTERVALS, SENSITIVITY_PROFILES } from '@pagepulse/config';

export default function NewWatchPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [sensitivity, setSensitivity] = useState<'low' | 'normal' | 'high' | 'custom'>('normal');

  // Selectors
  const [includeSelectors, setIncludeSelectors] = useState<string[]>([]);
  const [ignoreSelectors, setIgnoreSelectors] = useState<string[]>([]);
  const [newIncludeSel, setNewIncludeSel] = useState('');
  const [newIgnoreSel, setNewIgnoreSel] = useState('');

  // Noise rules
  const [stripTimestamps, setStripTimestamps] = useState(true);
  const [stripRelativeTime, setStripRelativeTime] = useState(true);
  const [stripCounters, setStripCounters] = useState(false);
  const [stripRandomTokens, setStripRandomTokens] = useState(true);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddIncludeSelector = () => {
    if (newIncludeSel.trim()) {
      setIncludeSelectors((prev) => [...prev, newIncludeSel.trim()]);
      setNewIncludeSel('');
    }
  };

  const handleAddIgnoreSelector = () => {
    if (newIgnoreSel.trim()) {
      setIgnoreSelectors((prev) => [...prev, newIgnoreSel.trim()]);
      setNewIgnoreSel('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          name: name || new URL(url).hostname,
          intervalMinutes,
          sensitivity,
          includeSelectors,
          ignoreSelectors,
          normalizationRules: {
            stripTimestamps,
            stripRelativeTime,
            stripCounters,
            stripRandomTokens,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to create watch');
      }

      router.push(`/watches/${json.data.id}`);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
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
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create New Watch</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure a public target URL, checking frequency, and noise suppression rules.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800">
            <span className="font-semibold">Error creating watch: </span>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {/* URL and Name */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              Public Target URL <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="url"
                required
                placeholder="https://example.com/pricing"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Must be a publicly accessible HTTP/HTTPS URL. Private IPs and internal metadata endpoints are strictly blocked.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">
              Watch Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Competitor Pricing Page"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 py-2 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Check Interval */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            Check Frequency Interval
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {[
              { label: '15m', val: 15 },
              { label: '30m', val: 30 },
              { label: '1h', val: 60 },
              { label: '3h', val: 180 },
              { label: '6h', val: 360 },
              { label: '12h', val: 720 },
              { label: '24h', val: 1440 },
            ].map(({ label, val }) => (
              <button
                type="button"
                key={val}
                onClick={() => setIntervalMinutes(val)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                  intervalMinutes === val
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Selected: Every {intervalMinutes} minutes ({Math.round(intervalMinutes / 60 * 10) / 10} hours).
          </p>
        </div>

        {/* Sensitivity */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <label className="block text-sm font-semibold text-slate-900">
            Change Detection Sensitivity
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'low',
                title: 'Low Sensitivity',
                desc: 'Alerts only on major content changes (>=15% text change)',
              },
              {
                id: 'normal',
                title: 'Normal (Recommended)',
                desc: 'Balanced for typical updates (>=5% text change)',
              },
              {
                id: 'high',
                title: 'High Sensitivity',
                desc: 'Alerts on minor edits (>=1% text change)',
              },
            ].map((p) => (
              <div
                key={p.id}
                onClick={() => setSensitivity(p.id as any)}
                className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                  sensitivity === p.id
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{p.title}</span>
                  {sensitivity === p.id && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                </div>
                <p className="text-xs text-slate-500 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Regions to Watch / Ignore */}
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">CSS Region Selectors (Optional)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify CSS selectors to limit monitoring to specific sections or strip ads and rotating banners.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Watch Specific Regions (Include)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. #pricing-table, .article-body"
                value={newIncludeSel}
                onChange={(e) => setNewIncludeSel(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleAddIncludeSelector}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {includeSelectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {includeSelectors.map((sel, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs font-mono text-indigo-700 border border-indigo-200"
                  >
                    {sel}
                    <button
                      type="button"
                      onClick={() => setIncludeSelectors((prev) => prev.filter((_, i) => i !== idx))}
                      className="hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Ignore Regions (Exclude)</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. .advertisement, #cookie-banner, .timestamp"
                value={newIgnoreSel}
                onChange={(e) => setNewIgnoreSel(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleAddIgnoreSelector}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {ignoreSelectors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ignoreSelectors.map((sel, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-700 border border-slate-300"
                  >
                    {sel}
                    <button
                      type="button"
                      onClick={() => setIgnoreSelectors((prev) => prev.filter((_, i) => i !== idx))}
                      className="hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Noise Filters */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Dynamic Noise Suppression</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stripTimestamps}
                onChange={(e) => setStripTimestamps(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Filter dates & timestamps (e.g. 2026-10-15)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stripRelativeTime}
                onChange={(e) => setStripRelativeTime(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Filter relative time labels (e.g. "5m ago")</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stripCounters}
                onChange={(e) => setStripCounters(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Filter volatile counters (e.g. "98 views")</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={stripRandomTokens}
                onChange={(e) => setStripRandomTokens(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Filter CSRF & session tokens</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || !url}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Establishing Baseline...' : 'Save & Establish Baseline'}
          </button>
        </div>
      </form>
    </div>
  );
}
