'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Trash2,
  Search,
  Filter,
  PlusCircle,
  Eye,
} from 'lucide-react';

interface WatchItem {
  id: string;
  name: string;
  targetUrl: string;
  hostname: string;
  intervalMinutes: number;
  enabled: boolean;
  sensitivity: string;
  status: 'OK' | 'ERROR' | 'BLOCKED' | 'PAUSED' | 'UNKNOWN';
  lastCheckedAt?: string | null;
  lastChangedAt?: string | null;
  nextCheckAt?: string | null;
  lastErrorMessage?: string | null;
}

export default function DashboardPage() {
  const [watches, setWatches] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());

  const fetchWatches = async () => {
    try {
      const res = await fetch('/api/watches');
      if (res.ok) {
        const json = await res.json();
        setWatches(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load watches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatches();
  }, []);

  const handleCheckNow = async (id: string) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/watches/${id}/check-now`, { method: 'POST' });
      if (res.ok) {
        await fetchWatches();
      }
    } catch (err) {
      console.error('Failed to run manual check:', err);
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleTogglePause = async (watch: WatchItem) => {
    try {
      const res = await fetch(`/api/watches/${watch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !watch.enabled }),
      });
      if (res.ok) {
        await fetchWatches();
      }
    } catch (err) {
      console.error('Failed to update watch:', err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete watch "${name}"?`)) return;
    try {
      const res = await fetch(`/api/watches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWatches((prev) => prev.filter((w) => w.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete watch:', err);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = watches.length;
    const ok = watches.filter((w) => w.status === 'OK').length;
    const errors = watches.filter((w) => w.status === 'ERROR').length;
    const blocked = watches.filter((w) => w.status === 'BLOCKED').length;
    const changedToday = watches.filter((w) => {
      if (!w.lastChangedAt) return false;
      const diffHours = (Date.now() - new Date(w.lastChangedAt).getTime()) / (1000 * 3600);
      return diffHours <= 24;
    }).length;

    return { total, ok, errors, blocked, changedToday };
  }, [watches]);

  // Filtered watches
  const filteredWatches = useMemo(() => {
    return watches.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.targetUrl.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PAUSED') return !w.enabled;
      return w.status === statusFilter && w.enabled;
    });
  }, [watches, searchQuery, statusFilter]);

  const getStatusBadge = (status: WatchItem['status'], enabled: boolean) => {
    if (!enabled) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          <Pause className="h-3 w-3" /> Paused
        </span>
      );
    }
    switch (status) {
      case 'OK':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Healthy
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" /> Error / Outage
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
            <ShieldAlert className="h-3 w-3" /> Blocked / CAPTCHA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" /> Initializing
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Watch Monitor</h1>
          <p className="text-sm text-slate-500 mt-1">
            Tracking public web pages for real changes with noise filtering and instant alerts.
          </p>
        </div>
        <Link
          href="/watches/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Add New Watch</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Watches</span>
            <Activity className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total}</p>
          <p className="text-xs text-slate-500 mt-1">{metrics.ok} healthy</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Changes (24h)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{metrics.changedToday}</p>
          <p className="text-xs text-slate-500 mt-1">Meaningful updates</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Outages / Errors</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-600">{metrics.errors}</p>
          <p className="text-xs text-slate-500 mt-1">Network & 5xx outages</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bot Challenges</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{metrics.blocked}</p>
          <p className="text-xs text-slate-500 mt-1">CAPTCHA & 403 blocks</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search watches or domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-slate-300 py-1.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <Filter className="h-4 w-4 text-slate-400 mr-1" />
          {['ALL', 'OK', 'ERROR', 'BLOCKED', 'PAUSED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Watches List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredWatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-base font-semibold text-slate-900">No watches found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {watches.length === 0
              ? 'Get started by creating your first website change detector watch.'
              : 'No watches matched your search or status filter.'}
          </p>
          <div className="mt-6">
            <Link
              href="/watches/new"
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Create Watch</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredWatches.map((watch) => {
            const isChecking = checkingIds.has(watch.id);
            return (
              <div
                key={watch.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow transition-shadow"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/watches/${watch.id}`}
                      className="font-semibold text-slate-900 hover:text-indigo-600 text-base truncate"
                    >
                      {watch.name}
                    </Link>
                    {getStatusBadge(watch.status, watch.enabled)}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <a
                      href={watch.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-indigo-600 truncate max-w-sm"
                    >
                      <span>{watch.targetUrl}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <span>•</span>
                    <span>Every {watch.intervalMinutes}m</span>
                    <span>•</span>
                    <span className="capitalize">{watch.sensitivity} Sensitivity</span>
                  </div>

                  {watch.lastErrorMessage && (
                    <p className="text-xs text-rose-600 mt-1 font-mono truncate">
                      Reason: {watch.lastErrorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <button
                    onClick={() => handleCheckNow(watch.id)}
                    disabled={isChecking}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                    title="Run manual check now"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Check Now</span>
                  </button>

                  <Link
                    href={`/watches/${watch.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>History</span>
                  </Link>

                  <button
                    onClick={() => handleTogglePause(watch)}
                    className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    title={watch.enabled ? 'Pause watch' : 'Resume watch'}
                  >
                    {watch.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>

                  <button
                    onClick={() => handleDelete(watch.id, watch.name)}
                    className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Delete watch"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
