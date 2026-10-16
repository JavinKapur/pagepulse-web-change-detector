'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  GitCompare,
  Calendar,
  FileText,
  Sliders,
  Check,
  Pause,
  Play,
} from 'lucide-react';

interface WatchDetail {
  id: string;
  name: string;
  targetUrl: string;
  hostname: string;
  intervalMinutes: number;
  enabled: boolean;
  sensitivity: string;
  status: 'OK' | 'ERROR' | 'BLOCKED' | 'PAUSED' | 'UNKNOWN';
  includeSelectors: string[];
  ignoreSelectors: string[];
  baselineEstablishedAt?: string | null;
  lastCheckedAt?: string | null;
  lastChangedAt?: string | null;
  lastErrorMessage?: string | null;
}

interface SnapshotItem {
  id: string;
  sequenceNo: number;
  contentHash: string;
  normalizedText: string;
  screenshotObjectKey?: string | null;
  previousSnapshotId?: string | null;
  changeSummaryJson: any;
  createdAt: string;
}

export default function WatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const watchId = resolvedParams.id;

  const [watch, setWatch] = useState<WatchDetail | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchData = async () => {
    try {
      const [watchRes, snapsRes] = await Promise.all([
        fetch(`/api/watches/${watchId}`),
        fetch(`/api/watches/${watchId}/snapshots`),
      ]);

      if (watchRes.ok) {
        const watchJson = await watchRes.json();
        setWatch(watchJson.data);
      }
      if (snapsRes.ok) {
        const snapsJson = await snapsRes.json();
        setSnapshots(snapsJson.data || []);
        if (snapsJson.data && snapsJson.data.length > 0) {
          setSelectedSnapshot(snapsJson.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load watch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [watchId]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await fetch(`/api/watches/${watchId}/check-now`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Check failed:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleTogglePause = async () => {
    if (!watch) return;
    try {
      const res = await fetch(`/api/watches/${watch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !watch.enabled }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!watch) {
    return (
      <div className="text-center py-16">
        <h2 className="text-lg font-semibold text-slate-900">Watch Not Found</h2>
        <Link href="/" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      </div>

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{watch.name}</h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                watch.status === 'OK'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : watch.status === 'BLOCKED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : watch.status === 'ERROR'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {watch.status === 'OK' && <CheckCircle2 className="h-3 w-3" />}
              {watch.status === 'ERROR' && <AlertTriangle className="h-3 w-3" />}
              {watch.status === 'BLOCKED' && <ShieldAlert className="h-3 w-3" />}
              <span>{watch.status}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
            <a
              href={watch.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-mono"
            >
              <span>{watch.targetUrl}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <span>Check interval: Every {watch.intervalMinutes}m</span>
            <span>•</span>
            <span className="capitalize">{watch.sensitivity} Sensitivity</span>
          </div>

          {watch.lastErrorMessage && (
            <p className="text-xs text-rose-600 font-mono mt-2 bg-rose-50 p-2 rounded border border-rose-200">
              Latest diagnostic: {watch.lastErrorMessage}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Check Now</span>
          </button>

          <button
            onClick={handleTogglePause}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            {watch.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{watch.enabled ? 'Pause' : 'Resume'}</span>
          </button>

          {snapshots.length >= 2 && (
            <Link
              href={`/watches/${watch.id}/diff?from=${snapshots[1].id}&to=${snapshots[0].id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <GitCompare className="h-3.5 w-3.5" />
              <span>Compare Versions</span>
            </Link>
          )}
        </div>
      </div>

      {/* Main Grid: Snapshot Timeline (Left) & Content Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-indigo-600" />
              <span>Snapshot Timeline ({snapshots.length})</span>
            </h2>
          </div>

          <div className="space-y-2">
            {snapshots.map((snap) => {
              const isSelected = selectedSnapshot?.id === snap.id;
              const isBaseline = snap.changeSummaryJson?.isBaseline;
              return (
                <div
                  key={snap.id}
                  onClick={() => setSelectedSnapshot(snap)}
                  className={`cursor-pointer rounded-lg border p-4 transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      Version #{snap.sequenceNo}
                    </span>
                    {isBaseline ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                        BASELINE
                      </span>
                    ) : (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800">
                        CHANGED
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-1">
                    {snap.changeSummaryJson?.summary || (isBaseline ? 'Baseline established' : 'Content update')}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(snap.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Snapshot Preview */}
        <div className="lg:col-span-2 space-y-4">
          {selectedSnapshot ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Version #{selectedSnapshot.sequenceNo} Snapshot
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Hash: {selectedSnapshot.contentHash.slice(0, 16)}...
                  </p>
                </div>

                {snapshots.length >= 2 && selectedSnapshot.sequenceNo > 1 && (
                  <Link
                    href={`/watches/${watch.id}/diff?from=${
                      snapshots.find((s) => s.sequenceNo === selectedSnapshot.sequenceNo - 1)?.id || snapshots[0].id
                    }&to=${selectedSnapshot.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    <span>View Diff Against Prior Version</span>
                  </Link>
                )}
              </div>

              {/* Text view */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Normalized Content Representation
                </label>
                <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                  {selectedSnapshot.normalizedText || '(Empty content extracted)'}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
              Select a snapshot from the timeline to inspect its content.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
