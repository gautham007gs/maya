"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { RefreshCcw, RotateCcw, Save, Cpu } from 'lucide-react';

/**
 * AI Models management card (Admin → AI Keys tab).
 *
 * Models change frequently and providers decommission old IDs without much
 * notice. For every provider the admin can view the built-in default cascade
 * and override it with their own ordered list — no code deploy needed.
 * An override REPLACES the default list for that provider; clearing it
 * restores the built-in defaults.
 */

const PROVIDER_ICONS: Record<string, string> = {
  gemini: '🟢', cloudflare: '🟠', groq: '⚡', cerebras: '🧠', sambanova: '🚀',
  github: '🐙', openrouter: '🌐', nvidia: '💚', mistral: '🌊', cohere: '🔶', deepseek: '🔵',
};

interface ProviderDefaults {
  [provider: string]: string[];
}

export default function ProviderModelsCard() {
  const { toast } = useToast();
  const [defaults, setDefaults] = useState<ProviderDefaults>({});
  const [overrides, setOverrides] = useState<ProviderDefaults>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/provider-models');
      if (!res.ok) return;
      const data = await res.json();
      const defs: ProviderDefaults = data.defaults || {};
      const ovr: ProviderDefaults = data.overrides || {};
      setDefaults(defs);
      setOverrides(ovr);
      setOrder(Object.keys(defs));
      // Draft per provider: current override if any, otherwise empty
      // (empty input = "use defaults", shown via placeholder).
      const d: Record<string, string> = {};
      for (const p of Object.keys(defs)) d[p] = (ovr[p] || []).join(', ');
      setDrafts(d);
      setLoaded(true);
    } catch {
      // silent — card just stays empty if the endpoint is unavailable
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isDirty = (p: string) => {
    const draftModels = drafts[p]?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    return JSON.stringify(draftModels) !== JSON.stringify(overrides[p] || []);
  };

  const save = async (provider: string) => {
    const models = (drafts[provider] || '').split(',').map(s => s.trim()).filter(Boolean);
    setSavingFor(provider);
    try {
      const res = await fetch('/api/admin/provider-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, models: models.length ? models : null }),
      });
      const data = await res.json();
      if (data.success) {
        const ovr: ProviderDefaults = data.overrides || {};
        setOverrides(ovr);
        setDrafts(prev => ({ ...prev, [provider]: (ovr[provider] || []).join(', ') }));
        toast({
          title: '✅ Models updated',
          description: `${provider}: ${models.length ? `now using ${models.length} admin-set model${models.length !== 1 ? 's' : ''}` : 'restored to built-in defaults'}. Applies from the next chat request.`,
        });
      } else {
        toast({ title: 'Error saving models', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Network error', description: err.message, variant: 'destructive' });
    } finally { setSavingFor(null); }
  };

  const resetOne = async (provider: string) => {
    setSavingFor(provider);
    try {
      const res = await fetch('/api/admin/provider-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, models: null }),
      });
      const data = await res.json();
      if (data.success) {
        const ovr: ProviderDefaults = data.overrides || {};
        setOverrides(ovr);
        setDrafts(prev => ({ ...prev, [provider]: '' }));
        toast({ title: `✅ ${provider} restored to built-in defaults` });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Network error', description: err.message, variant: 'destructive' });
    } finally { setSavingFor(null); }
  };

  if (!loaded || order.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="h-4 w-4" /> AI Models
        </CardTitle>
        <CardDescription>
          Providers decommission models every few weeks. Set your own model cascade per provider — comma-separated,
          tried left → right on failure. Leave empty to use the built-in verified defaults. Changes apply without a deploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.map(p => {
          const def = defaults[p] || [];
          const ovr = overrides[p];
          return (
            <div key={p} className={`border rounded-lg p-3 space-y-2 ${ovr ? 'border-violet-300 dark:border-violet-800' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{PROVIDER_ICONS[p] ?? '🔌'}</span>
                <span className="font-medium text-sm capitalize">{p}</span>
                {ovr ? (
                  <Badge className="text-[10px] py-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Custom</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] py-0">Defaults</Badge>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {isDirty(p) && <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">unsaved</span>}
                  {(drafts[p] || '') !== '' && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => resetOne(p)} disabled={savingFor === p}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Defaults
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => save(p)} disabled={savingFor === p || !isDirty(p)}>
                    {savingFor === p ? <RefreshCcw className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
              <Input
                value={drafts[p] || ''}
                onChange={e => setDrafts(prev => ({ ...prev, [p]: e.target.value }))}
                placeholder={def.join(', ')}
                className="text-xs font-mono"
                aria-label={`Model cascade for ${p}`}
              />
              <p className="text-[11px] text-muted-foreground">
                Default order: <span className="font-mono">{def.join(' → ')}</span>
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

