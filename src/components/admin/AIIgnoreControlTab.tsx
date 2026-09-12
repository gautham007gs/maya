"use client";

/**
 * AIIgnoreControlTab — Admin UI for the global AI-ignore feature toggle.
 *
 * ON  (default) → Kruthika's realistic micro-pause / busy behaviour works for
 *                 all users exactly as designed.
 * OFF           → the ignore system is fully bypassed: she replies to every
 *                 message immediately, even overriding a pause already running
 *                 for a user.
 *
 * Saved to app_configurations ('ai_ignore_settings') via /api/admin/ai-ignore.
 * Applies to ALL users in real time (instant on this server; ≤10 s elsewhere).
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { EyeOff, CheckCircle2, Info, RefreshCcw } from 'lucide-react';

interface AIIgnoreSettings {
  ignore_enabled: boolean;
}

export default function AIIgnoreControlTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AIIgnoreSettings>({ ignore_enabled: true });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-ignore');
      if (!res.ok) return;
      const data = await res.json();
      if (data.settings) setSettings(data.settings);
    } catch {} // silent — defaults render until first successful load
    finally { setLoaded(true); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleToggle = async (enabled: boolean) => {
    const previous = settings;
    setSettings({ ignore_enabled: enabled }); // optimistic
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-ignore', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignore_enabled: enabled }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(data.settings);
        toast({
          title: '✅ Saved',
          description: enabled
            ? 'Ignore feature re-enabled for all users.'
            : 'Ignore disabled — Kruthika now replies to every message instantly.',
        });
      } else {
        setSettings(previous); // rollback
        toast({ title: 'Error', description: data.error || 'Could not save setting', variant: 'destructive' });
      }
    } catch {
      setSettings(previous); // rollback
      toast({ title: 'Network error', description: 'Could not save setting', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const isEnabled = settings.ignore_enabled === true;

  return (
    <div className="space-y-5">
      {/* ── Main toggle card ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <EyeOff className="h-5 w-5 text-violet-600" />
                AI Ignore Feature
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                Controls Kruthika&apos;s realistic &quot;busy&quot; micro-pauses (30–60 min natural texting
                breaks) across the entire app and every user.
              </CardDescription>
            </div>
            <Badge variant={isEnabled ? 'default' : 'destructive'} className="shrink-0">
              {isEnabled ? 'ACTIVE' : 'DISABLED'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
              isEnabled
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            }`}
          >
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                {isEnabled ? 'Ignore feature is working normally' : 'Ignore feature is turned OFF'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {isEnabled
                  ? 'Kruthika occasionally takes natural micro-pauses with warm reunion messages (never for new users or light chats).'
                  : 'Kruthika replies to EVERY message right away — no pauses, even if one was already running.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!loaded && <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={saving || !loaded}
                aria-label="Toggle AI ignore feature"
              />
            </div>
          </div>

          {isEnabled ? (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="text-xs">
                Default behaviour. Built-in safety rails still apply: new users, low-engagement
                sessions and peak evening hours are never ignored.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs">
                While OFF, no user can be paused or ignored anywhere in the app. Re-enabling restores
                normal behaviour instantly — any leftover pause timers simply expire naturally.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 space-y-1">
            <p><strong>Scope:</strong> applies globally to all users on both chat entry points (server action + API).</p>
            <p><strong>Propagation:</strong> takes effect immediately after saving; other servers pick it up within ~10 seconds.</p>
            <p><strong>Fail-safe:</strong> if the settings store is unreachable, the feature stays in its normal (ON) state.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

