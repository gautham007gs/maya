"use client";

/**
 * VoiceSettingsTab — Admin UI for voice provider management.
 *
 * Sections:
 *  1. Provider toggles  — Enable/disable ElevenLabs and Sarvam AI independently
 *  2. ElevenLabs keys   — Add/remove/test EL API keys (multi-key rotation)
 *  3. Sarvam keys       — Embedded SarvamKeysTab (unchanged)
 *
 * Routing logic (shown in info box):
 *   ElevenLabs ON  → tries EL first; if all EL keys exhausted → Sarvam fallback
 *   ElevenLabs OFF → goes straight to Sarvam
 *   Both OFF       → voice disabled
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  RefreshCcw, CirclePlus, Trash2, TriangleAlert,
  CheckCircle2, ShieldCheck, Mic, Clock, Info, Zap, Volume2,
} from 'lucide-react';
import SarvamKeysTab from './SarvamKeysTab';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VoiceSettings {
  elevenlabs_enabled: boolean;
  sarvam_enabled: boolean;
}

interface ELKey {
  id: number;
  label: string;
  prefix: string;
  exhausted: boolean;
  exhaustedAt: string | null;
  source: 'db' | 'env';
  createdAt: string | null;
}

interface PoolStatus { total: number; active: number; exhausted: number }

// ── Component ─────────────────────────────────────────────────────────────────

export default function VoiceSettingsTab() {
  const { toast } = useToast();

  // ── Voice provider settings ───────────────────────────────────────────────
  const [settings, setSettings] = useState<VoiceSettings>({ elevenlabs_enabled: true, sarvam_enabled: true });
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/voice-settings');
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch {}
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const toggleProvider = async (key: 'elevenlabs_enabled' | 'sarvam_enabled', val: boolean) => {
    const optimistic = { ...settings, [key]: val };
    setSettings(optimistic);
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/voice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: val }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        toast({ title: `✅ Saved`, description: `${key === 'elevenlabs_enabled' ? 'ElevenLabs' : 'Sarvam AI'} ${val ? 'enabled' : 'disabled'}.` });
      } else {
        setSettings(settings); // rollback
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      setSettings(settings);
      toast({ title: 'Network error', description: 'Could not save settings', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  // ── ElevenLabs keys ───────────────────────────────────────────────────────
  const [elKeys, setElKeys] = useState<ELKey[]>([]);
  const [elPool, setElPool] = useState<PoolStatus>({ total: 0, active: 0, exhausted: 0 });
  const [elLoading, setElLoading] = useState(true);
  const [_testingId, _setTestingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [form, setForm] = useState({ label: '', value: '' });
  const [adding, setAdding] = useState(false);

  const fetchElKeys = useCallback(async () => {
    setElLoading(true);
    try {
      const res = await fetch('/api/admin/elevenlabs-keys');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setElKeys(data.keys ?? []);
      setElPool(data.pool ?? { total: 0, active: 0, exhausted: 0 });
    } catch (err: any) {
      toast({ title: 'Error loading ElevenLabs keys', description: err.message, variant: 'destructive' });
    } finally {
      setElLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchElKeys(); }, [fetchElKeys]);

  const addElKey = async () => {
    if (!form.label.trim() || !form.value.trim()) {
      toast({ title: 'Missing fields', description: 'Label and API key are required', variant: 'destructive' });
      return;
    }
    if (!form.value.trim().startsWith('sk_') || form.value.trim().length < 20) {
      toast({ title: 'Invalid key', description: 'ElevenLabs keys start with sk_ and are 40+ chars', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/admin/elevenlabs-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: form.label.trim(), value: form.value.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Key added ✅', description: `"${form.label}" saved. It will be used immediately.` });
        setForm({ label: '', value: '' });
        await fetchElKeys();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  };

  const deleteElKey = async (id: number, label: string) => {
    if (!confirm(`Delete ElevenLabs key "${label}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/elevenlabs-keys/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Deleted', description: `"${label}" removed.` });
        await fetchElKeys();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const resetElKey = async (id: number, label: string) => {
    const res = await fetch(`/api/admin/elevenlabs-keys/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    });
    const data = await res.json();
    if (data.success) {
      toast({ title: 'Reset ✅', description: `"${label}" is now active again.` });
      await fetchElKeys();
    }
  };

  const dbElKeys  = elKeys.filter(k => k.source === 'db');
  const envElKeys = elKeys.filter(k => k.source === 'env');

  return (
    <div className="space-y-8">

      {/* ── Section 1: Provider Toggles ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Volume2 className="h-5 w-5 text-primary" />
            Voice Provider Priority
          </CardTitle>
          <CardDescription>
            Control which voice engine Kruthika uses. ElevenLabs is tried first — if all its
            keys are exhausted, Sarvam AI kicks in automatically as fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Flow diagram */}
          <div className="flex items-center gap-2 flex-wrap text-sm bg-muted/50 rounded-lg px-4 py-3">
            <span className="font-semibold">Priority:</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${settings.elevenlabs_enabled ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-muted text-muted-foreground line-through'}`}>
              1. ElevenLabs
            </span>
            <span className="text-muted-foreground">→ if exhausted →</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${settings.sarvam_enabled ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-muted text-muted-foreground line-through'}`}>
              2. Sarvam AI
            </span>
            <span className="text-muted-foreground">→ if exhausted →</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Silent (no voice)</span>
          </div>

          {/* ElevenLabs toggle */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-600" />
                <Label className="text-base font-semibold text-violet-900 dark:text-violet-300">ElevenLabs Voice</Label>
                <Badge variant="outline" className="text-xs border-violet-300 text-violet-600">PRIMARY</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Best emotional quality — intimate, sweet, teen-girl feel. Uses Jessica voice
                (eleven_multilingual_v2 model). Supports Hindi + English natively.
                ElevenLabs free tier: 10,000 chars/month per key.
              </p>
            </div>
            <Switch
              checked={settings.elevenlabs_enabled}
              disabled={savingSettings}
              onCheckedChange={val => toggleProvider('elevenlabs_enabled', val)}
              className="data-[state=checked]:bg-violet-600 shrink-0 mt-1"
            />
          </div>

          {/* Sarvam toggle */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-orange-600" />
                <Label className="text-base font-semibold text-orange-900 dark:text-orange-300">Sarvam AI Voice</Label>
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">FALLBACK</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Native Indian pronunciation — perfect Hinglish/Hindi. Uses vidya voice
                (bulbul:v2, pitch+0.60). Sarvam free tier: 100 calls per key.
              </p>
            </div>
            <Switch
              checked={settings.sarvam_enabled}
              disabled={savingSettings}
              onCheckedChange={val => toggleProvider('sarvam_enabled', val)}
              className="data-[state=checked]:bg-orange-500 shrink-0 mt-1"
            />
          </div>

          {!settings.elevenlabs_enabled && !settings.sarvam_enabled && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>
                <strong>Both providers disabled!</strong> Voice messages are completely off for all users.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: ElevenLabs Keys ─────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-violet-600" />
          <h3 className="text-lg font-semibold">ElevenLabs API Keys</h3>
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2 text-sm">
            <Zap className="h-4 w-4 text-violet-600" />
            <span className="text-violet-700 dark:text-violet-400">
              <strong>{elPool.active}</strong> active ElevenLabs key{elPool.active !== 1 ? 's' : ''}
            </span>
          </div>
          {elPool.exhausted > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2 text-sm">
              <TriangleAlert className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-700 dark:text-yellow-400"><strong>{elPool.exhausted}</strong> exhausted</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-muted/60 border rounded-lg px-3 py-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground"><strong>{elPool.total}</strong> total configured</span>
          </div>
        </div>

        {settings.elevenlabs_enabled && elPool.active === 0 && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>
              <strong>No active ElevenLabs keys!</strong> Voice will fall back to Sarvam. Add a key below or disable ElevenLabs.
              Get free keys at{' '}
              <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline font-medium">elevenlabs.io</a>
              {' '}— 10,000 free chars/month per account.
            </AlertDescription>
          </Alert>
        )}

        {/* Info box */}
        <div className="flex gap-2 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3 text-xs text-violet-800 dark:text-violet-300">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p><strong>Voice used:</strong> Jessica (cgSgspJ2msm6clMCkdW9) — Playful, Bright, Warm, Young female. eleven_multilingual_v2 model with intimate voice settings (stability 0.22, style 0.58).</p>
            <p><strong>Auto-rotation:</strong> When a key hits its quota (402 error), it is automatically marked exhausted and the next key is tried.</p>
            <p><strong>Free tier note:</strong> ElevenLabs free accounts are blocked from VPN/proxy IPs. Keys work perfectly on deployed production URLs (real user IPs).</p>
          </div>
        </div>

        {/* DB keys */}
        {elLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCcw className="h-5 w-5 mr-2 animate-spin" />Loading ElevenLabs keys…
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />Admin-Added ElevenLabs Keys
                </CardTitle>
                <CardDescription>
                  Keys added here are stored in the database and auto-removed when quota is hit.
                  {dbElKeys.length === 0 && ' No admin-added keys yet — add one below.'}
                </CardDescription>
              </CardHeader>
              {dbElKeys.length > 0 && (
                <CardContent className="p-0">
                  <div className="divide-y">
                    {dbElKeys.map(key => (
                      <div key={key.id} className="flex items-start justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{key.label}</p>
                            {key.exhausted ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">⚠️ Exhausted</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✅ Active</span>
                            )}
                            <Badge variant="outline" className="text-xs py-0 font-mono">{key.prefix}</Badge>
                          </div>
                          {key.exhausted && key.exhaustedAt && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                              <Clock className="h-3 w-3" />Exhausted {new Date(key.exhaustedAt).toLocaleDateString()}
                            </p>
                          )}
                          {key.createdAt && (
                            <p className="text-xs text-muted-foreground mt-0.5">Added {new Date(key.createdAt).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {key.exhausted && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => resetElKey(key.id, key.label)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Reset
                            </Button>
                          )}
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                            onClick={() => deleteElKey(key.id, key.label)}
                            disabled={deletingId === key.id}
                          >
                            {deletingId === key.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Env keys */}
            {envElKeys.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />Environment Variable Keys
                  </CardTitle>
                  <CardDescription>
                    Set via <code className="bg-muted px-1 rounded text-xs">ELEVENLABS_API_KEY_1</code>…<code className="bg-muted px-1 rounded text-xs">ELEVENLABS_API_KEY_20</code> in your host environment variables.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {envElKeys.map(key => (
                      <div key={key.id} className="flex items-start justify-between gap-3 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm font-mono text-xs">{key.label}</p>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">ENV</span>
                            {key.exhausted ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">⚠️ Exhausted</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✅ Active</span>
                            )}
                            <Badge variant="outline" className="text-xs py-0 font-mono">{key.prefix}</Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">Remove via your environment variable manager</p>
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
                  <CirclePlus className="h-4 w-4" />Add ElevenLabs API Key
                </CardTitle>
                <CardDescription>
                  Get a free key at{' '}
                  <a href="https://elevenlabs.io/app/speech-synthesis" target="_blank" rel="noopener noreferrer"
                     className="underline text-blue-600 dark:text-blue-400">elevenlabs.io</a>
                  {' '}→ Profile → API Key. Free tier: 10,000 chars/month per account.
                  Keys are stored in the DB and <strong>never shown again</strong> after saving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Label (nickname)</Label>
                    <Input
                      placeholder="e.g. ElevenLabs Key 1"
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
                <Button onClick={addElKey} disabled={adding} className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700">
                  {adding
                    ? <><RefreshCcw className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                    : <><CirclePlus className="h-4 w-4 mr-2" />Add ElevenLabs Key</>}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
          <p><strong>Free tier:</strong> 10,000 characters/month per ElevenLabs account (≈ 50–100 voice messages)</p>
          <p><strong>Auto-rotation:</strong> Keys rotate automatically when quota is hit — add multiple keys for seamless coverage</p>
          <p><strong>Production only:</strong> ElevenLabs blocks free-tier calls from VPN/proxy IPs on some dev environments. Keys work normally for real users on your deployed app.</p>
        </div>
      </div>

      {/* ── Section 3: Sarvam Keys ──────────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-semibold">Sarvam AI Voice Keys</h3>
          <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">FALLBACK</Badge>
        </div>
        <SarvamKeysTab />
      </div>

    </div>
  );
}
