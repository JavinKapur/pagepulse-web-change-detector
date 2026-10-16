'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  GitCompare,
  RefreshCw,
  Plus,
  Minus,
  Check,
  Calendar,
  Layers,
} from 'lucide-react';

interface DiffData {
  watchId: string;
  fromSnapshot: { id: string; sequenceNo: number; createdAt: string; contentHash: string };
  toSnapshot: { id: string; sequenceNo: number; createdAt: string; contentHash: string };
  diff: {
    hasChanges: boolean;
    addedLines: number;
    deletedLines: number;
    addedWords: number;
    deletedWords: number;
    textChangeRatio: number;
    summary: string;
    chunks: Array<{ type: 'added' | 'deleted' | 'unchanged'; value: string; linesCount: number }>;
  };
}

export default function DiffComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const watchId = resolvedParams.id;
  const searchParams = useSearchParams();

  const fromId = searchParams.get('from');
  const toId = searchParams.get('to');

  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromId || !toId) {
      setError('Please select both a source and target version to compare.');
      setLoading(false);
      return;
    }

    const fetchDiff = async () => {
      try {
        const res = await fetch(`/api/watches/${watchId}/diff?from=${fromId}&to=${toId}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || 'Failed to compute diff');
        }
        setDiffData(json.data);
      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [watchId, fromId, toId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error || !diffData) {
    return (
      <div className="space-y-4">
        <Link
          href={`/watches/${watchId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Watch</span>
        </Link>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="font-semibold">Unable to generate comparison:</p>
          <p className="text-sm mt-1">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const { diff, fromSnapshot, toSnapshot } = diffData;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/watches/${watchId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Watch Timeline</span>
        </Link>
      </div>

      {/* Header and comparison bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold text-slate-900">Version Diff Comparison</h1>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="rounded bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 border border-emerald-200">
              +{diff.addedLines} lines (+{diff.addedWords} words)
            </span>
            <span className="rounded bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 border border-rose-200">
              -{diff.deletedLines} lines (-{diff.deletedWords} words)
            </span>
            <span className="rounded bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              {(diff.textChangeRatio * 100).toFixed(1)}% changed
            </span>
          </div>
        </div>

        {/* Versions compared */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="font-bold text-slate-900">Baseline / Prior: Version #{fromSnapshot.sequenceNo}</span>
            <p className="text-slate-500 mt-1">Recorded: {new Date(fromSnapshot.createdAt).toLocaleString()}</p>
          </div>

          <div className="rounded-lg bg-indigo-50/50 p-3 border border-indigo-200">
            <span className="font-bold text-indigo-950">Target / New: Version #{toSnapshot.sequenceNo}</span>
            <p className="text-slate-500 mt-1">Recorded: {new Date(toSnapshot.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Structured Diff View */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Unified Line-by-Line Changes
          </span>
          <span className="text-xs text-slate-500">{diff.summary}</span>
        </div>

        <div className="divide-y divide-slate-100 font-mono text-xs overflow-x-auto">
          {diff.chunks.map((chunk, idx) => {
            if (chunk.type === 'added') {
              return (
                <div key={idx} className="bg-emerald-50 text-emerald-950 px-4 py-1.5 flex items-start gap-2">
                  <Plus className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <pre className="whitespace-pre-wrap font-mono flex-1">{chunk.value}</pre>
                </div>
              );
            }
            if (chunk.type === 'deleted') {
              return (
                <div key={idx} className="bg-rose-50 text-rose-950 px-4 py-1.5 flex items-start gap-2">
                  <Minus className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <pre className="whitespace-pre-wrap font-mono flex-1 line-through opacity-80">{chunk.value}</pre>
                </div>
              );
            }
            return (
              <div key={idx} className="bg-white text-slate-600 px-4 py-1.5 flex items-start gap-2">
                <span className="w-3.5 text-slate-300 select-none"> </span>
                <pre className="whitespace-pre-wrap font-mono flex-1 opacity-70">{chunk.value}</pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
