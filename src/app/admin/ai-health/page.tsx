"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CmsWorkspaceShell from '@/components/admin/CmsWorkspaceShell';

import { useToast } from '@/hooks/use-toast';
import {
  RefreshCcw, CirclePlay, CheckCircle2, XCircle, AlertTriangle,
  Clock, Zap, Shield, Activity, KeyRound, ExternalLink,
  WifiOff, Loader2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type ProviderHealth = 'ok' | 'warning' | 'error' | 'disabled' | 'no-key';
type OverallHealth  = 'healthy' | 'degraded' | 'critical';

interface ProviderSummary {
  id: string;
  label: string;
  model: string;
  description: string;
  enabled: boolean;
  hasEnvKey: boolean;
  dbKeyCount: number;
  activeDbKeys: number;
  problemKeys: number;
  disabledKeys: number;
  totalErrors: number;
  lastUsed: string | null;
  lastError: string | null;
  health: ProviderHealth;
}

interface LogEntry {
  key_id: number;
  provider: string;
  event_type: string;
  message: string;
  created_at: string;
}

interface HealthSnapshot {
  providers: ProviderSummary[];
  recentLogs: LogEntry[];
  overallHealth: OverallHealth;
  readyCount: number;
  totalProviders: number;
  checkedAt: string;
}

interface TestResult {
  ok: boolean;
  latencyMs: number;
  modelUsed?: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_ICONS: Record<string, string> = {
  groq: '⚡', cerebras: '🧠', sambanova: '🚀', gemini: '🟢',
  github: '🐙', openrouter: '🌐', nvidia: '💚', mistral: '🌊',
  cohere: '🔶', deepseek: '🔵',
};

function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function HealthDot({ h }: { h: ProviderHealth }) {
  const map: Record<ProviderHealth, string> = {
    ok:       'bg-green-500',
    warning:  'bg-yellow-500',
    error:    'bg-red-500',
    disabled: 'bg-gray-400',
    'no-key': 'bg-gray-300 dark:bg-gray-600',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${map[h]}`} />;
}

function HealthLabel({ h }: { h: ProviderHealth }) {
  const map: Record<ProviderHealth, { text: string; cls: string }> = {
    ok:       { text: 'Ready',    cls: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' },
    warning:  { text: 'Warning',  cls: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800' },
    error:    { text: 'Error',    cls: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
    disabled: { text: 'Disabled', cls: 'text-gray-500 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700' },
    'no-key': { text: 'No key',   cls: 'text-gray-500 bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700' },
  };
  const { text, cls } = map[h];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      <HealthDot h={h} />
      {text}
    </span>
  );
}

function EventBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    added:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    exhausted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    error:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    disabled:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${map[type] ?? map.error}`}>
      {type}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AIHealthPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [authed, setAuthed]         = useState(false);
  const [loading, setLoading]       = useState(true);
  const [snapshot, setSnapshot]     = useState<HealthSnapshot | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult & { testing?: boolean }>>({});
  const [testingAll, setTestingAll] = useState(false);

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/session')
      .then(r => {
        if (!r.ok) router.replace('/admin/login?returnUrl=/admin/ai-health');
        else setAuthed(true);
      })
      .catch(() => router.replace('/admin/login?returnUrl=/admin/ai-health'));
  }, [router]);

  // ── Fetch snapshot ──────────────────────────────────────────────────────────
  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai-health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthSnapshot = await res.json();
      setSnapshot(data);
    } catch (err: any) {
      toast({ title: 'Failed to load health data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (authed) fetchSnapshot(); }, [authed, fetchSnapshot]);

  // ── Test single provider ────────────────────────────────────────────────────
  const testProvider = async (providerId: string) => {
    setTestResults(prev => ({ ...prev, [providerId]: { ok: false, latencyMs: 0, testing: true } }));
    try {
      const res = await fetch('/api/admin/ai-health/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      });
      const result: TestResult = await res.json();
      setTestResults(prev => ({ ...prev, [providerId]: { ...result, testing: false } }));
      if (result.ok) {
        toast({ title: `✅ ${providerId} is working`, description: `${result.latencyMs}ms · ${result.modelUsed ?? ''}` });
      } else {
        toast({ title: `❌ ${providerId} failed`, description: result.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [providerId]: { ok: false, latencyMs: 0, error: err.message, testing: false } }));
      toast({ title: `${providerId} test error`, description: err.message, variant: 'destructive' });
    }
  };

  // ── Test all providers sequentially ─────────────────────────────────────────
  const testAll = async () => {
    if (!snapshot) return;
    setTestingAll(true);
    for (const p of snapshot.providers) {
      if (!p.enabled) continue;
      await testProvider(p.id);
    }
    setTestingAll(false);
    toast({ title: 'All tests complete', description: 'Results shown on each provider card.' });
  };

  // ── Loading / unauthed ──────────────────────────────────────────────────────
  if (!authed || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!snapshot) return null;

  const { providers, recentLogs, overallHealth, readyCount, totalProviders, checkedAt } = snapshot;

  const overallConfig = {
    healthy:  { label: 'All systems operational',     cls: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300',  Icon: Shield },
    degraded: { label: 'Partially degraded',           cls: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300', Icon: AlertTriangle },
    critical: { label: 'No providers ready — AI down', cls: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',    Icon: XCircle },
  }[overallHealth];

  const { label: overallLabel, cls: overallCls, Icon: OverallIcon } = overallConfig;

  return (
    <CmsWorkspaceShell
      title="AI Health Dashboard"
      eyebrow="Providers & Uptime"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSnapshot} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={testAll} disabled={testingAll || loading} className="bg-violet-600 hover:bg-violet-700 text-white">
            {testingAll
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Testing…</>
              : <><CirclePlay className="h-4 w-4 mr-1.5" />Test All</>}
          </Button>
        </div>
      }
    >
    <div className="space-y-6">
      <p className="text-xs text-slate-500 -mt-4">
        Last checked {relativeTime(checkedAt)} · {readyCount}/{totalProviders} providers ready
      </p>

      {/* Overall health banner */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${overallCls}`}>
        <OverallIcon className="h-5 w-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{overallLabel}</p>
          <p className="text-xs opacity-75 mt-0.5">
            {readyCount} of {totalProviders} providers have active keys and are enabled
          </p>
        </div>
        <Link href="/admin/profile" className="text-xs underline opacity-75 hover:opacity-100 flex-shrink-0 flex items-center gap-1">
          <KeyRound className="h-3 w-3" />Manage keys
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ready', value: providers.filter(p => p.health === 'ok').length,       icon: CheckCircle2, cls: 'text-green-600' },
          { label: 'Warning', value: providers.filter(p => p.health === 'warning').length, icon: AlertTriangle, cls: 'text-yellow-600' },
          { label: 'No key', value: providers.filter(p => p.health === 'no-key').length,  icon: WifiOff,       cls: 'text-gray-500' },
          { label: 'Disabled', value: providers.filter(p => p.health === 'disabled').length, icon: XCircle,  cls: 'text-gray-400' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <Card key={label} className="py-3 px-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground truncate">{label}</p>
              </div>
              <Icon className={`h-6 w-6 shrink-0 ${cls}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Provider cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {providers.map(p => {
          const icon     = PROVIDER_ICONS[p.id] ?? '🤖';
          const tr       = testResults[p.id];
          const isTesting = tr?.testing === true;

          return (
            <Card
              key={p.id}
              className={`transition-colors ${!p.enabled ? 'opacity-55 border-dashed' : ''}`}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl leading-none">{icon}</span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{p.label}</CardTitle>
                      <CardDescription className="text-xs truncate font-mono">{p.model}</CardDescription>
                    </div>
                  </div>
                  <HealthLabel h={p.health} />
                </div>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* Stats row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <KeyRound className="h-3 w-3" />
                    {p.hasEnvKey
                      ? `ENV key${p.dbKeyCount > 0 ? ` + ${p.dbKeyCount} DB` : ''}`
                      : p.dbKeyCount === 0 ? 'No key configured'
                      : `${p.activeDbKeys} active / ${p.dbKeyCount} DB key${p.dbKeyCount !== 1 ? 's' : ''}`}
                  </span>
                  {p.totalErrors > 0 && (
                    <span className="flex items-center gap-1 text-orange-500">
                      <AlertTriangle className="h-3 w-3" />
                      {p.totalErrors} error{p.totalErrors !== 1 ? 's' : ''}
                    </span>
                  )}
                  {p.lastUsed && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Used {relativeTime(p.lastUsed)}
                    </span>
                  )}
                </div>

                {/* Last error (if any) */}
                {p.lastError && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1.5 break-words line-clamp-2">
                    {p.lastError}
                  </p>
                )}

                {/* Test result */}
                {tr && !isTesting && (
                  <div className={`rounded px-2.5 py-1.5 text-xs flex items-start gap-1.5 ${
                    tr.ok
                      ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                  }`}>
                    {tr.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      : <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />}
                    <span className="break-words">
                      {tr.ok
                        ? `${tr.latencyMs}ms · ${tr.modelUsed ?? 'OK'}`
                        : (tr.error ?? 'Failed')}
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2.5"
                    onClick={() => testProvider(p.id)}
                    disabled={isTesting || testingAll}
                  >
                    {isTesting
                      ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing…</>
                      : <><Zap className="h-3 w-3 mr-1" />Test</>}
                  </Button>
                  <Link
                    href="/admin/profile"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2.5 border rounded-md hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Keys
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent activity log */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <CardDescription className="text-xs">Last {recentLogs.length} events from all provider keys</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="divide-y max-h-72 overflow-y-auto">
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                  <span className="text-base leading-none flex-shrink-0 pt-0.5">
                    {PROVIDER_ICONS[log.provider] ?? '🤖'}
                  </span>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium capitalize">{log.provider}</span>
                      <EventBadge type={log.event_type} />
                      <span className="text-xs text-muted-foreground">{relativeTime(log.created_at)}</span>
                    </div>
                    {log.message && (
                      <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recentLogs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="text-sm">No activity logged yet.</p>
            <p className="text-xs">Activity appears here when keys are used, rate-limited, or fail.</p>
          </CardContent>
        </Card>
      )}

    </div>
    </CmsWorkspaceShell>
  );
}
