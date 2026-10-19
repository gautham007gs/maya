"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ProviderModelsCard from '@/components/admin/ProviderModelsCard';
import {
  CirclePlus, Trash2, RefreshCcw, CirclePlay, TriangleAlert,
  CheckCircle2, Clock, ChevronDown, ChevronUp, ShieldCheck, Zap, Edit3, KeyRound, Info, RotateCcw,
} from 'lucide-react';

type KeyStatus = 'active' | 'exhausted' | 'error' | 'disabled';

interface ApiKey {
  id: number; provider: string; key_label: string; key_value_masked: string;
  priority: number; status: KeyStatus; last_used: string | null;
  last_error: string | null; error_count: number; created_at: string; is_env_key?: boolean;
}

interface ProviderInfo {
  id: string; label: string; model: string; description: string;
  enabled: boolean; keyCount: number; maxKeys: number; canAddKey: boolean;
}

const PROVIDER_ICONS: Record<string, string> = {
  gemini: '🟢', cloudflare: '🟠', groq: '⚡', cerebras: '🧠', sambanova: '🚀',
  github: '🐙', openrouter: '🌐', nvidia: '💚', mistral: '🌊', cohere: '🔶', deepseek: '🔵',
};

const PROVIDER_HELP: Record<string, string> = {
  gemini:     'aistudio.google.com → API keys (FREE — 1500 req/day, starts with AIza…)',
  cloudflare: '⚠️ Cloudflare needs TWO values: API Token + Account ID (see fields below)',
  groq:       'console.groq.com → API Keys (FREE — ultra-fast LPU, multiple models)',
  cerebras:   'cloud.cerebras.ai → Sign Up → API Keys (FREE — 1M tokens/day, ~2600 tok/sec)',
  sambanova:  'cloud.sambanova.ai → Sign Up → API Keys (FREE — Llama 70B cascade)',
  github:     'github.com/settings/tokens → Generate new token (classic), no scopes needed',
  openrouter: 'openrouter.ai → Sign In → Keys (FREE :free pool)',
  nvidia:     'build.nvidia.com → Developer Account → Get API Key (starts with nvapi-)',
  mistral:    'console.mistral.ai → API Keys (FREE)',
  cohere:     'dashboard.cohere.com → API Keys (Trial free tier)',
  deepseek:   'platform.deepseek.com → API Keys (paid, very cheap)',
};

// Cloudflare is special — it needs 2 fields
const CF_PROVIDER = 'cloudflare';

function StatusBadge({ status }: { status: KeyStatus }) {
  const map: Record<KeyStatus, { label: string; className: string }> = {
    active:    { label: '✅ Active',    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    exhausted: { label: '⚠️ Exhausted', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    error:     { label: '❌ Error',     className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    disabled:  { label: '⏸ Disabled',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  };
  const { label, className } = map[status] ?? map.error;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{label}</span>;
}

export default function AIKeysTab() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [togglingProvider, setTogglingProvider] = useState<string | null>(null);
  const [ranks, setRanks] = useState<Record<string, number>>({});
  const [rankDraft, setRankDraft] = useState<Record<string, number>>({});
  const [savingRanks, setSavingRanks] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [form, setForm] = useState({ provider: 'gemini', key_label: '', key_value: '', cf_account_id: '', priority: '1' });
  const [adding, setAdding] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [editForm, setEditForm] = useState({ key_label: '', key_value: '', cf_account_id: '', priority: '1', status: 'active' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPriorityInfo, setShowPriorityInfo] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/api-keys');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
      if (data.providers) setProviders(data.providers);
      // Provider priority ranks (cascade ordering)
      try {
        const rres = await fetch('/api/admin/provider-priority');
        if (rres.ok) {
          const rd = await rres.json();
          if (rd.ranks) { setRanks(rd.ranks); setRankDraft(rd.ranks); }
        }
      } catch {}
    } catch (err: any) {
      toast({ title: 'Error loading keys', description: err.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Provider priority ranking (cascade ordering) ──────────────────────────
  // Editing a dropdown only updates the LOCAL draft — nothing is written to the
  // DB until "Save Ranking" is clicked. Conflict rule (mirrors the server):
  // only ONE provider can hold a given rank; if another provider already holds
  // it in the draft, that provider drops back to Auto.
  const setRankDraftFor = (providerId: string, rank: number | null) => {
    setRankDraft(prev => {
      const next = { ...prev };
      if (rank === null) {
        delete next[providerId];
      } else {
        for (const [p, r] of Object.entries(next)) {
          if (p !== providerId && r === rank) delete next[p]; // displaced → Auto
        }
        next[providerId] = rank;
      }
      return next;
    });
  };

  const ranksDirty = JSON.stringify(rankDraft) !== JSON.stringify(ranks);

  const saveRanks = async () => {
    setSavingRanks(true);
    try {
      const res = await fetch('/api/admin/provider-priority', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranks: rankDraft }),
      });
      const data = await res.json();
      if (data.success) {
        const normalized: Record<string, number> = data.ranks || {};
        setRanks(normalized);
        setRankDraft(normalized);
        toast({ title: '✅ Ranking saved', description: 'The new cascade order applies from the very next chat request.' });
      } else {
        toast({ title: 'Error saving ranking', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Network error', description: err.message, variant: 'destructive' });
    } finally { setSavingRanks(false); }
  };

  const resetRanks = async () => {
    setSavingRanks(true);
    try {
      const res = await fetch('/api/admin/provider-priority', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (data.success) {
        setRanks({});
        setRankDraft({});
        toast({ title: '✅ All providers reset to Auto' });
      } else {
        toast({ title: 'Error resetting ranking', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Network error', description: err.message, variant: 'destructive' });
    } finally { setSavingRanks(false); }
  };

  const toggleProvider = async (providerId: string, enabled: boolean) => {
    setTogglingProvider(providerId);
    try {
      const res = await fetch('/api/admin/api-keys/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setProviders(prev => prev.map(p => p.id === providerId ? { ...p, enabled } : p));
        toast({ title: enabled ? `${providerId} enabled` : `${providerId} disabled` });
      } else toast({ title: 'Error', description: data.error, variant: 'destructive' });
    } finally { setTogglingProvider(null); }
  };

  // Build final key_value — Cloudflare combines token:::accountId
  const buildKeyValue = (provider: string, keyValue: string, cfAccountId: string) => {
    if (provider === CF_PROVIDER) {
      if (!keyValue.trim() || !cfAccountId.trim()) return null;
      return `${keyValue.trim()}:::${cfAccountId.trim()}`;
    }
    return keyValue.trim() || null;
  };

  const addKey = async () => {
    const finalKeyValue = buildKeyValue(form.provider, form.key_value, form.cf_account_id);
    if (!finalKeyValue) {
      toast({
        title: form.provider === CF_PROVIDER ? 'Both API Token and Account ID required' : 'Missing key value',
        description: form.provider === CF_PROVIDER
          ? 'Enter your Cloudflare API Token and Account ID'
          : 'Please enter the API key value',
        variant: 'destructive'
      });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.provider,
          key_label: form.key_label.trim() || undefined,
          key_value: finalKeyValue,
          priority: Number(form.priority),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Key added ✅', description: `"${data.key_label}" saved with AES-256-GCM encryption.` });
        setForm(f => ({ ...f, key_label: '', key_value: '', cf_account_id: '', priority: '1' }));
        setExpandedProvider(form.provider);
        await fetchData();
      } else toast({ title: 'Error', description: data.error, variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Network Error', description: err.message, variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const openEditModal = (key: ApiKey) => {
    setEditingKey(key);
    setEditForm({ key_label: key.key_label, key_value: '', cf_account_id: '', priority: String(key.priority), status: key.status });
  };

  const saveEditedKey = async () => {
    if (!editingKey) return;
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        key_label: editForm.key_label.trim(),
        priority: Number(editForm.priority),
        status: editForm.status,
      };
      if (editForm.key_value.trim()) {
        const newVal = buildKeyValue(editingKey.provider, editForm.key_value, editForm.cf_account_id);
        if (!newVal) {
          toast({ title: 'Account ID also required for Cloudflare', variant: 'destructive' });
          setSavingEdit(false);
          return;
        }
        payload.key_value = newVal;
      }
      const res = await fetch(`/api/admin/api-keys/${editingKey.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Key Updated ✅', description: `"${editForm.key_label}" updated.` });
        setEditingKey(null);
        await fetchData();
      } else toast({ title: 'Error updating key', description: data.error, variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingEdit(false); }
  };

  const deleteKey = async (id: number, label: string) => {
    if (!confirm(`Delete key "${label}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      toast({ title: 'Deleted', description: `"${label}" removed.` });
      await fetchData();
    } else toast({ title: 'Error', description: data.error, variant: 'destructive' });
  };

  const resetKey = async (id: number) => {
    const res = await fetch(`/api/admin/api-keys/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    const data = await res.json();
    if (data.success) { toast({ title: 'Reset ✅', description: 'Key reset to Active.' }); await fetchData(); }
    else toast({ title: 'Error', description: data.error, variant: 'destructive' });
  };

  const testKey = async (id: number, label: string) => {
    setTestingId(id);
    try {
      const res = await fetch('/api/admin/api-keys/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) toast({ title: `✅ Working! (${data.latencyMs}ms)`, description: `"${label}" is responding correctly.` });
      else toast({ title: '❌ Key failed', description: data.error || 'Unknown error', variant: 'destructive' });
      await fetchData();
    } finally { setTestingId(null); }
  };

  const dbKeys = keys.filter(k => !k.is_env_key);
  const envKeys = keys.filter(k => k.is_env_key);
  const exhausted = keys.filter(k => k.status === 'exhausted' || k.status === 'error');
  const activeCount = keys.filter(k => k.status === 'active').length;
  const enabledProviders = providers.filter(p => p.enabled);
  const isCF = (p: string) => p === CF_PROVIDER;

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />Loading AI configuration…
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Status bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span className="text-green-700 dark:text-green-400">
            <strong>{activeCount}</strong> active of <strong>{keys.length}</strong> total ({dbKeys.length} DB + {envKeys.length} ENV)
          </span>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
          <Zap className="h-4 w-4 text-blue-600" />
          <span className="text-blue-700 dark:text-blue-400"><strong>{enabledProviders.length}</strong> of 11 providers enabled</span>
        </div>
        <button
          onClick={() => setShowPriorityInfo(!showPriorityInfo)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-2 transition-colors"
        >
          <Info className="h-3.5 w-3.5" />How priority works
        </button>
      </div>

      {showPriorityInfo && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 text-sm space-y-2">
          <p className="font-semibold text-blue-800 dark:text-blue-300">🎯 How the AI cascade & priority works:</p>
          <p className="text-blue-700 dark:text-blue-400">
            <strong>Provider Order</strong> (left to right): Gemini → Cloudflare → Groq → Cerebras → SambaNova → GitHub → OpenRouter → NVIDIA → Mistral → Cohere → DeepSeek
          </p>
          <p className="text-blue-700 dark:text-blue-400">
            <strong>Priority number</strong> (1–99): Within the same provider, lower priority number = tried first. 
            E.g. if you have 3 Groq keys at Priority 1, 2, 3 — key P1 is tried first, then P2, then P3.
          </p>
          <p className="text-blue-700 dark:text-blue-400">
            <strong>Auto-rotation</strong>: If a key hits a rate limit or returns an error, it's marked Exhausted and the next key is tried instantly. When all keys of one provider are exhausted, the AI falls through to the next provider.
          </p>
          <p className="text-blue-700 dark:text-blue-400">
            <strong>Toggle switch</strong>: Disabling a provider completely skips it in the cascade.
          </p>
        </div>
      )}

      {activeCount === 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
            <TriangleAlert className="h-5 w-5" />⚠️ No active AI keys — chat replies will fail
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Add at least one key below to enable AI. Gemini (aistudio.google.com) or Groq (console.groq.com) are free and take 2 minutes to set up.</p>
        </div>
      )}

      {activeCount > 0 && exhausted.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>{exhausted.length} key(s) exhausted:</strong>{' '}
            {exhausted.map(k => `${k.key_label} (${k.provider})`).join(', ')}.{' '}
            Click <strong>Replace / Edit</strong> on the key to swap it with a fresh one.
          </AlertDescription>
        </Alert>
      )}

      {/* Provider grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Providers & Keys</CardTitle>
      <CardDescription>
            Toggle providers on/off. Disabled providers are completely skipped.
            {providers.length > 0 && (() => {
              const ordered = [...providers].sort((a, b) => {
                const ra = rankDraft[a.id], rb = rankDraft[b.id];
                if (ra && rb) return ra - rb;
                if (ra) return -1;
                if (rb) return 1;
                return 0;
              });
              return (
                <>
                  {' '}Live cascade:{' '}
                  <span className="font-medium">
                    {ordered.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && ' → '}
                        <span className={rankDraft[p.id] ? 'text-violet-700 dark:text-violet-300' : ''}>
                          {p.label}
                          {rankDraft[p.id] ? ` (#${rankDraft[p.id]})` : ''}
                          {!p.enabled && ' (off)'}
                        </span>
                      </span>
                    ))}
                  </span>
                  <br />
                  Pick a priority rank per provider — ranked providers are tried first; everyone else keeps auto order. Click <strong>Save Ranking</strong> to apply.
                  {ranksDirty && <><br /><strong className="text-amber-600 dark:text-amber-400">● Unsaved ranking changes — click Save Ranking.</strong></>}
                </>
              );
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Ranking save controls */}
          <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b">
            {ranksDirty && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" /> Unsaved changes
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={resetRanks}
                disabled={savingRanks || (!ranksDirty && Object.keys(rankDraft).length === 0)}
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Reset to Auto
              </Button>
              <Button size="sm" onClick={saveRanks} disabled={savingRanks || !ranksDirty}>
                {savingRanks
                  ? <><RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
                  : <>Save Ranking</>}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providers.map(p => {
              const providerKeys = keys.filter(k => k.provider === p.id);
              const hasIssues = providerKeys.some(k => k.status === 'error' || k.status === 'exhausted');
              const isExpanded = expandedProvider === p.id;
              return (
                <div key={p.id} className={`border rounded-lg overflow-hidden transition-colors ${p.enabled ? 'border-border' : 'border-dashed border-muted-foreground/30 opacity-60'}`}>
                  <div className="flex items-center justify-between p-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{PROVIDER_ICONS[p.id]}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm truncate">{p.label}</p>
                          {rankDraft[p.id] && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${ranks[p.id] === rankDraft[p.id]
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                              #{rankDraft[p.id]}
                            </span>
                          )}
                          {hasIssues && <TriangleAlert className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.keyCount === 0 ? 'No keys' : `${p.keyCount} key${p.keyCount !== 1 ? 's' : ''}`}
                          {p.keyCount > 0 && (
                            <span className="ml-1 text-green-600 dark:text-green-400">
                              ({providerKeys.filter(k => k.status === 'active').length} active)
                            </span>
                          )}
                          {p.id === CF_PROVIDER && p.keyCount === 0 && (
                            <span className="ml-1 text-orange-500 text-xs">Needs API Token + Account ID</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Select
                        value={rankDraft[p.id] ? String(rankDraft[p.id]) : 'auto'}
                        onValueChange={v => setRankDraftFor(p.id, v === 'auto' ? null : Number(v))}
                        disabled={savingRanks}
                      >
                        <SelectTrigger className="h-8 w-[92px] text-xs" aria-label={`Priority rank for ${p.label}`}>
                          <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          {providers.map((_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                              Rank {i + 1}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Switch checked={p.enabled} disabled={togglingProvider === p.id} onCheckedChange={v => toggleProvider(p.id, v)} />
                      {p.keyCount > 0 && (
                        <button onClick={() => setExpandedProvider(isExpanded ? null : p.id)} className="text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && providerKeys.length > 0 && (
                    <div className="border-t bg-muted/30 divide-y">
                      {providerKeys.map(key => (
                        <div key={key.id} className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium">{key.key_label}</p>
                                {key.is_env_key && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">ENV</span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-muted-foreground">{key.key_value_masked}</p>
                            </div>
                            <StatusBadge status={key.status} />
                          </div>
                          {key.last_error && (
                            <p className="text-xs text-destructive bg-destructive/10 rounded p-1.5 break-all">{key.last_error}</p>
                          )}
                          {key.is_env_key ? (
                            <p className="text-xs text-muted-foreground">Managed via environment variable (.env file)</p>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs py-0">Priority {key.priority}</Badge>
                                {key.last_used && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(key.last_used).toLocaleDateString()}</span>}
                                {key.error_count > 0 && <span className="text-orange-500">{key.error_count} errors</span>}
                              </div>
                              <div className="flex gap-1.5 flex-wrap">
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => testKey(key.id, key.key_label)} disabled={testingId === key.id}>
                                  {testingId === key.id ? <><RefreshCcw className="h-3 w-3 mr-1 animate-spin" />Testing…</> : <><CirclePlay className="h-3 w-3 mr-1" />Test</>}
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openEditModal(key)}>
                                  <Edit3 className="h-3 w-3 mr-1" />Replace / Edit
                                </Button>
                                {key.status !== 'active' && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => resetKey(key.id)}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />Reset
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive" onClick={() => deleteKey(key.id, key.key_label)}>
                                  <Trash2 className="h-3 w-3 mr-1" />Delete
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add key form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CirclePlus className="h-4 w-4" />Add New API Key</CardTitle>
          <CardDescription>
            Keys are stored with <strong>AES-256-GCM encryption</strong> and never exposed to the client.
            Add multiple keys per provider — AI auto-rotates when limits are hit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v, key_value: '', cf_account_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={!p.canAddKey}>
                      {PROVIDER_ICONS[p.id]} {p.label}
                      {!p.canAddKey ? ' (full)' : p.keyCount > 0 ? ` (${p.keyCount} keys)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PROVIDER_HELP[form.provider]}</p>
            </div>

            <div className="space-y-1.5">
              <Label>Label <span className="text-muted-foreground font-normal">(optional, auto-generated if blank)</span></Label>
              <Input placeholder={`e.g. ${form.provider}-key-2`} value={form.key_label} onChange={e => setForm(f => ({ ...f, key_label: e.target.value }))} />
            </div>

            {isCF(form.provider) ? (
              <>
                <div className="space-y-1.5">
                  <Label>Cloudflare API Token <span className="text-red-500">*</span></Label>
                  <Input type="password" placeholder="Paste CF API Token here" value={form.key_value} onChange={e => setForm(f => ({ ...f, key_value: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">dash.cloudflare.com → My Profile → API Tokens → Create Token → Workers AI template</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Cloudflare Account ID <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. a1b2c3d4e5f6..." value={form.cf_account_id} onChange={e => setForm(f => ({ ...f, cf_account_id: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">dash.cloudflare.com → Workers & Pages → Overview (right sidebar)</p>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>API Key Value <span className="text-red-500">*</span></Label>
                <Input type="password" placeholder="Paste your API key here" value={form.key_value} onChange={e => setForm(f => ({ ...f, key_value: e.target.value }))} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                Priority <span className="text-muted-foreground font-normal">(1=highest, tried first within this provider)</span>
              </Label>
              <Input type="number" min={1} max={99} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} />
            </div>
          </div>
          <Button onClick={addKey} disabled={adding} className="w-full sm:w-auto">
            {adding ? <><RefreshCcw className="h-4 w-4 mr-2 animate-spin" />Saving & Encrypting…</> : <><CirclePlus className="h-4 w-4 mr-2" />Add Key Securely</>}
          </Button>
        </CardContent>
      </Card>

      {/* Edit / Replace Modal */}
      <Dialog open={!!editingKey} onOpenChange={open => !open && setEditingKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Update Key: {editingKey?.key_label}
            </DialogTitle>
            <DialogDescription>
              Replace an exhausted or erroring key with a fresh value. Leave key value blank to only update label/priority/status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Key Label</Label>
              <Input value={editForm.key_label} onChange={e => setEditForm(f => ({ ...f, key_label: e.target.value }))} />
            </div>
            {editingKey?.provider === CF_PROVIDER ? (
              <>
                <div className="space-y-1.5">
                  <Label>New Cloudflare API Token <span className="text-muted-foreground font-normal">(leave blank to keep)</span></Label>
                  <Input type="password" placeholder="Paste new CF API Token" value={editForm.key_value} onChange={e => setEditForm(f => ({ ...f, key_value: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cloudflare Account ID <span className="text-muted-foreground font-normal">(required if updating token)</span></Label>
                  <Input placeholder="Account ID" value={editForm.cf_account_id} onChange={e => setEditForm(f => ({ ...f, cf_account_id: e.target.value }))} />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label>New API Key Value <span className="text-muted-foreground font-normal">(leave blank to keep existing)</span></Label>
                <Input type="password" placeholder="Paste fresh API key to replace old one" value={editForm.key_value} onChange={e => setEditForm(f => ({ ...f, key_value: e.target.value }))} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority (1=highest)</Label>
                <Input type="number" min={1} max={99} value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKey(null)}>Cancel</Button>
            <Button onClick={saveEditedKey} disabled={savingEdit}>
              {savingEdit ? <><RefreshCcw className="h-4 w-4 mr-2 animate-spin" />Updating…</> : 'Save & Reactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model management — per-provider editable model cascades */}
      <ProviderModelsCard />

      <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
        <p><strong>Security:</strong> All API keys encrypted at rest with AES-256-GCM. Raw credentials never sent to the browser.</p>
        <p><strong>Auto-rotation:</strong> Exhausted key → next priority key → next provider. Zero downtime for users.</p>
      </div>
    </div>
  );
}
