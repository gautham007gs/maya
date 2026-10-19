"use client";

/**
 * SarvamKeysTab — Admin UI for managing Sarvam AI TTS API keys.
 *
 * Sarvam free plan gives 100 API calls per key.
 * Once a key hits its limit (402 response), it is automatically
 * deleted from the DB — it has zero value after credits run out.
 *
 * Strategy:
 *  - Add multiple keys upfront; they're tried in order
 *  - Exhausted/deleted keys are removed automatically — no manual cleanup needed
 *  - Env-var keys (SARVAM_API_KEY_1..20) are shown as read-only with their exhaustion state
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCcw, CirclePlus, Trash2, CirclePlay, TriangleAlert,
  CheckCircle2, ShieldCheck, Mic, Clock, Info,
} from 'lucide-react';

interface SarvamKey {
  id: number;
  label: string;
  prefix: string;        // fingerprint e.g. "sk_29u…kWesSWY0"
  isExhausted: boolean;
  exhaustedAt: string | null;
  source: 'db' | 'env';  // env keys can't be deleted via UI
  createdAt: string | null;
}

interface PoolStatus {
  total: number;
  active: number;
  exhausted: number;
}

export default function SarvamKeysTab() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<SarvamKey[]>([]);
  const [pool, setPool] = useState<PoolStatus>({ total: 0, active: 0, exhausted: 0 });
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [form, setForm] = useState({ label: '', value: '' });
  const [adding, setAdding] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sarvam-keys');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKeys(data.keys ?? []);
      setPool(data.pool ?? { total: 0, active: 0, exhausted: 0 });
    } catch (err: any) {
      toast({ title: 'Error loading Sarvam keys', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const addKey = async () => {
    if (!form.label.trim() || !form.value.trim()) {
      toast({ title: 'Missing fields', description: 'Label and API key are required', variant: 'destructive' });
      return;
    }
    if (form.value.trim().length < 10) {
      toast({ title: 'Invalid key', description: 'Sarvam keys should be longer than 10 chars', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/sarvam-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label.trim(), value: form.value.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Key added ✅', description: `"${form.label}" saved. It will be used immediately.` });
        setForm({ label: '', value: '' });
        await fetchKeys();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  };

  const deleteKey = async (id: number, label: string) => {
    if (!confirm(`Delete Sarvam key "${label}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/sarvam-keys/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Deleted', description: `"${label}" removed.` });
        await fetchKeys();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const resetKey = async (id: number, label: string) => {
    const res = await fetch(`/api/admin/sarvam-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    const data = await res.json();
    if (data.success) {
      toast({ title: 'Reset ✅', description: `"${label}" is now active again.` });
      await fetchKeys();
    } else {
      toast({ title: 'Error', description: data.error, variant: 'destructive' });
    }
  };

  const testKey = async (id: number, label: string, source: 'db' | 'env') => {
    setTestingId(id);
    try {
      const res = await fetch('/api/admin/sarvam-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, source }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({
          title: `✅ Working! (${data.latencyMs}ms)`,
          description: `"${label}" generated ${data.durationSeconds?.toFixed(1)}s of audio successfully.`,
        });
      } else {
        toast({ title: '❌ Key failed', description: data.error || 'Unknown error', variant: 'destructive' });
      }
      await fetchKeys();
    } finally {
      setTestingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />Loading Sarvam voice keys…
      </div>
    );
  }

  const dbKeys = keys.filter(k => k.source === 'db');
  const envKeys = keys.filter(k => k.source === 'env');

  return (
    <div className="space-y-6">

      {/* Status bar */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2 text-sm">
          <Mic className="h-4 w-4 text-purple-600" />
          <span className="text-purple-700 dark:text-purple-400">
            <strong>{pool.active}</strong> active Sarvam key{pool.active !== 1 ? 's' : ''}
          </span>
        </div>
        {pool.exhausted > 0 && (
          <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 text-sm">
            <TriangleAlert className="h-4 w-4 text-yellow-600" />
            <span className="text-yellow-700 dark:text-yellow-400">
              <strong>{pool.exhausted}</strong> exhausted (auto-removed from rotation)
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 bg-muted/60 border rounded-lg px-3 py-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground"><strong>{pool.total}</strong> total keys configured</span>
        </div>
      </div>

      {/* No active keys warning */}
      {pool.active === 0 && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>No active Sarvam keys!</strong> Voice messages will fail until you add a fresh key.
            Get a free key at{' '}
            <a href="https://dashboard.sarvam.ai" target="_blank" rel="noopener noreferrer"
               className="underline font-medium">dashboard.sarvam.ai</a>
            {' '}— 100 free API calls per account.
          </AlertDescription>
        </Alert>
      )}

      {/* How it works info box */}
      <div className="flex gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p><strong>Auto-rotation:</strong> Keys are tried in order. When a key hits its 100-call free limit (402 error), it is <strong>automatically deleted</strong> — exhausted keys have zero value.</p>
          <p><strong>Tip:</strong> Add several keys upfront (get a free key per Gmail/Google account at dashboard.sarvam.ai). The system rotates through them seamlessly with zero downtime.</p>
        </div>
      </div>

      {/* DB-stored keys (admin-added) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4" />Admin-Added Sarvam Keys
          </CardTitle>
          <CardDescription>
            Keys added here are stored in the database and auto-deleted when credits run out.
            {dbKeys.length === 0 && ' No admin-added keys yet — add one below.'}
          </CardDescription>
        </CardHeader>
        {dbKeys.length > 0 && (
          <CardContent className="p-0">
            <div className="divide-y">
              {dbKeys.map(key => (
                <div key={key.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{key.label}</p>
                      {key.isExhausted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          ⚠️ Exhausted
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          ✅ Active
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs py-0 font-mono">{key.prefix}</Badge>
                    </div>
                    {key.isExhausted && key.exhaustedAt && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Exhausted {new Date(key.exhaustedAt).toLocaleDateString()}
                      </p>
                    )}
                    {key.createdAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Added {new Date(key.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs px-2"
                      onClick={() => testKey(key.id, key.label, 'db')}
                      disabled={testingId === key.id || key.isExhausted}
                    >
                      {testingId === key.id
                        ? <><RefreshCcw className="h-3 w-3 mr-1 animate-spin" />Testing…</>
                        : <><CirclePlay className="h-3 w-3 mr-1" />Test</>}
                    </Button>
                    {key.isExhausted && (
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs px-2"
                        onClick={() => resetKey(key.id, key.label)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />Reset
                      </Button>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={() => deleteKey(key.id, key.label)}
                      disabled={deletingId === key.id}
                    >
                      {deletingId === key.id
                        ? <RefreshCcw className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3 mr-1" />}
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Env-var keys (read-only display) */}
      {envKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />Environment Variable Keys
            </CardTitle>
            <CardDescription>
              Keys set via <code className="bg-muted px-1 rounded text-xs">SARVAM_API_KEY_1</code>…<code className="bg-muted px-1 rounded text-xs">SARVAM_API_KEY_20</code> in your host environment variables.
              Exhausted env keys are skipped automatically but remain in the secret store until removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {envKeys.map(key => (
                <div key={key.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm font-mono text-xs">{key.label}</p>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">ENV</span>
                      {key.isExhausted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          ⚠️ Exhausted
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          ✅ Active
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs py-0 font-mono">{key.prefix}</Badge>
                    </div>
                    {key.isExhausted && key.exhaustedAt && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Exhausted {new Date(key.exhaustedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs px-2"
                      onClick={() => testKey(key.id, key.label, 'env')}
                      disabled={testingId === key.id || key.isExhausted}
                    >
                      {testingId === key.id
                        ? <><RefreshCcw className="h-3 w-3 mr-1 animate-spin" />Testing…</>
                        : <><CirclePlay className="h-3 w-3 mr-1" />Test</>}
                    </Button>
                    {key.isExhausted && (
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs px-2"
                        onClick={() => resetKey(key.id, key.label)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />Reset
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">Remove via your environment variable manager</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add key form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CirclePlus className="h-4 w-4" />Add Sarvam API Key
          </CardTitle>
          <CardDescription>
            Get a free key at{' '}
            <a href="https://dashboard.sarvam.ai" target="_blank" rel="noopener noreferrer"
               className="underline text-blue-600 dark:text-blue-400">dashboard.sarvam.ai</a>
            {' '}(100 free calls per account — one key per Google account).
            Key values are stored in the database and <strong>never shown again</strong> after saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Label (nickname)</Label>
              <Input
                placeholder="e.g. Sarvam Key 2 / Gmail-2"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Key Value</Label>
              <Input
                type="password"
                placeholder="sk_…"
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={addKey} disabled={adding} className="w-full sm:w-auto">
            {adding
              ? <><RefreshCcw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : <><CirclePlus className="h-4 w-4 mr-2" />Add Key</>}
          </Button>
        </CardContent>
      </Card>

      {/* Credits info */}
      <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
        <p><strong>Free tier:</strong> Each Sarvam API key gives 100 free TTS calls (≈ 100 voice messages)</p>
        <p><strong>Auto-cleanup:</strong> When a key hits 100 calls (402 error), it is permanently deleted — no manual cleanup needed</p>
        <p><strong>Rotation order:</strong> Environment variable keys first (SARVAM_API_KEY_1, 2, …), then admin-added keys in order of creation</p>
        <p><strong>Bulk keys:</strong> Create multiple Google accounts → get a free Sarvam key per account → add all here for seamless rotation</p>
      </div>
    </div>
  );
}
