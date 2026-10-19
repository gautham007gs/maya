"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Bell, Send, Users, RefreshCcw, CheckCircle2, AlertCircle, Loader2,
  Tag, Globe, Zap, Clock, Info, Image as ImageIcon, Sparkles,
  Eye, Trash2, MessageSquare, CalendarClock, Play, Copy, Shield, BarChart2,
  TrendingUp, MousePointerClick, Package,
} from 'lucide-react';
import { sendReengagement, fetchReengagementTemplates, type ReengagementTemplate, type ReengagementAudience } from '@/lib/smart-notifications';

/* ─── Types ─────────────────────────────────────────────── */

interface OneSignalStats {
  configured: boolean;
  subscribers: number;
  appName?: string;
}

interface NotificationHistory {
  id: string;
  title: string;
  message: string;
  recipients: number;
  sentAt: string;
  status: 'success' | 'error';
  error?: string;
  type: 'manual' | 'reengagement';
  scheduledFor?: string;
}

type TargetMode = 'all' | 'tags';
interface TagFilter { key: string; relation: string; value: string; }

/* ─── Constants ──────────────────────────────────────────── */

const HISTORY_KEY = 'admin_notif_history_v2';

/* ─── Helpers ────────────────────────────────────────────── */

function loadHistory(): NotificationHistory[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h: NotificationHistory[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30)));
}

/* ─── Component ──────────────────────────────────────────── */

export default function NotificationsTab() {
  const { toast } = useToast();

  /* Stats */
  const [stats, setStats] = useState<OneSignalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* Manual compose */
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [sendAfter, setSendAfter] = useState('');
  const [minScheduleTime, setMinScheduleTime] = useState('');
  const [targetMode, setTargetMode] = useState<TargetMode>('all');
  const [tags, setTags] = useState<TagFilter[]>([{ key: '', relation: '=', value: '' }]);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; recipients?: number; scheduledFor?: string; error?: string } | null>(null);

  /* Re-engagement */
  const [reTemplates, setReTemplates] = useState<ReengagementTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [reCustomTitle, setReCustomTitle] = useState('');
  const [reCustomMsg, setReCustomMsg] = useState('');
  const [reImageUrl, setReImageUrl] = useState('');
  const [reIconUrl, setReIconUrl] = useState('');
  const [reSending, setReSending] = useState(false);
  const [reResult, setReResult] = useState<{ success: boolean; recipients?: number; error?: string } | null>(null);
  /* Audience selector + confirmation */
  const [reAudience, setReAudience] = useState<'all' | 'inactive' | 'external_ids' | 'tags'>('all');
  const [reInactiveHours, setReInactiveHours] = useState(24);
  const [reExternalIds, setReExternalIds] = useState('');
  const [reTags, setReTags] = useState<TagFilter[]>([{ key: '', relation: '=', value: '' }]);
  const [reEstimate, setReEstimate] = useState<{ count: number | null; source?: string } | null>(null);
  const [rePendingSend, setRePendingSend] = useState(false);

  /* Cron / scheduled */
  const [cronWave, setCronWave] = useState<string>('auto');
  const [cronImageUrl, setCronImageUrl] = useState('');
  const [cronFiring, setCronFiring] = useState(false);
  const [cronResult, setCronResult] = useState<any>(null);
  const [cronPreview, setCronPreview] = useState<any>(null);
  const [cronPreviewLoading, setCronPreviewLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  /* Analytics */
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<'overview' | 'breakdown'>('overview');
  const analyticsLastFetch = React.useRef<number>(0);

  /* History */
  const [history, setHistory] = useState<NotificationHistory[]>([]);

  /* ── Load data ── */
  useEffect(() => { setHistory(loadHistory()); }, []);
  useEffect(() => {
    setMinScheduleTime(new Date(Date.now() + 60_000).toISOString().slice(0, 16));
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/notifications', { credentials: 'include' });
      setStats(await res.json());
    } catch { setStats({ configured: false, subscribers: 0 }); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    fetchReengagementTemplates().then(setReTemplates);
  }, []);

  /* ── Tag helpers ── */
  const addTag = () => setTags(p => [...p, { key: '', relation: '=', value: '' }]);
  const removeTag = (i: number) => setTags(p => p.filter((_, idx) => idx !== i));
  const updateTag = (i: number, f: keyof TagFilter, v: string) =>
    setTags(p => p.map((t, idx) => idx === i ? { ...t, [f]: v } : t));

  /* Re-engagement tag helpers */
  const addReTag = () => setReTags(p => [...p, { key: '', relation: '=', value: '' }]);
  const removeReTag = (i: number) => setReTags(p => p.filter((_, idx) => idx !== i));
  const updateReTag = (i: number, f: keyof TagFilter, v: string) =>
    setReTags(p => p.map((t, idx) => idx === i ? { ...t, [f]: v } : t));

  /* ── Manual send ── */
  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: 'Message required', variant: 'destructive' }); return;
    }
    setSending(true); setLastResult(null);

    const payload: Record<string, any> = {
      title: title.trim() || undefined,
      message: message.trim(),
      url: url.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      iconUrl: iconUrl.trim() || undefined,
      sendAfter: sendAfter ? new Date(sendAfter).toISOString() : undefined,
    };

    if (targetMode === 'tags') {
      const valid = tags.filter(t => t.key.trim() && t.value.trim());
      if (!valid.length) {
        toast({ title: 'Add at least one tag filter', variant: 'destructive' });
        setSending(false); return;
      }
      payload.segment = 'tags'; payload.tags = valid;
    } else {
      payload.segment = 'all';
    }

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLastResult({ success: true, recipients: data.recipients, scheduledFor: data.scheduledAt || undefined });
        toast({
          title: data.scheduled
            ? '✅ Notification scheduled'
            : `✅ Sent to ${data.recipients} subscriber${data.recipients !== 1 ? 's' : ''}!`,
          description: data.scheduledAt
            ? new Date(data.scheduledAt).toLocaleString()
            : undefined,
        });
        const entry: NotificationHistory = {
          id: data.notificationId ?? Date.now().toString(),
          title: title.trim() || 'Kruthika 💕',
          message: message.trim(),
          recipients: data.recipients,
          sentAt: new Date().toISOString(),
          status: 'success',
          type: 'manual',
          scheduledFor: data.scheduledAt,
        };
        const updated = [entry, ...history];
        setHistory(updated); saveHistory(updated);
        setMessage(''); setTitle(''); setUrl(''); setImageUrl(''); setIconUrl(''); setSendAfter('');
      } else {
        const err = data.error || 'Failed';
        setLastResult({ success: false, error: err });
        toast({ title: 'Send failed', description: err, variant: 'destructive' });
      }
    } catch (e: any) {
      const err = e?.message ?? 'Network error';
      setLastResult({ success: false, error: err });
      toast({ title: 'Error', description: err, variant: 'destructive' });
    } finally { setSending(false); }
  };

  /* ── Re-engagement audience helpers ── */
  const buildReAudience = (): ReengagementAudience => {
    if (reAudience === 'inactive') return { type: 'inactive', inactiveHours: reInactiveHours };
    if (reAudience === 'external_ids') {
      return { type: 'external_ids', externalIds: reExternalIds.split(',').map(s => s.trim()).filter(Boolean) };
    }
    if (reAudience === 'tags') {
      return { type: 'tags', tags: reTags.filter(t => t.key.trim() && t.value.trim()) };
    }
    return { type: 'all' };
  };

  /* ── Re-engagement send (two-phase: estimate → confirm) ── */
  const handleReSend = async () => {
    if (!selectedTemplate && !reCustomMsg.trim()) {
      toast({ title: 'Select a template or write a custom message', variant: 'destructive' }); return;
    }
    const base = {
      templateId: selectedTemplate || undefined,
      customTitle: reCustomTitle.trim() || undefined,
      customMessage: reCustomMsg.trim() || undefined,
      imageUrl: reImageUrl.trim() || undefined,
      iconUrl: reIconUrl.trim() || undefined,
      audience: buildReAudience(),
    };

    // Phase 1 — estimate (never sends)
    setReSending(true); setReResult(null); setReEstimate(null); setRePendingSend(false);
    const estimate = await sendReengagement({ ...base });
    setReSending(false);
    if (estimate.needsConfirmation) {
      setReEstimate({ count: estimate.estimatedRecipients ?? null, source: estimate.estimateSource });
      setRePendingSend(true);
      return;
    }
    if (estimate.error) {
      toast({ title: 'Estimate failed', description: estimate.error, variant: 'destructive' });
      return;
    }

    // Phase 2 — actually send
    setReSending(true);
    const result = await sendReengagement({ ...base, confirm: true });
    setReSending(false);
    setReResult(result.success ? { success: true, recipients: result.recipients } : { success: false, error: result.error });
    if (result.success) {
      toast({ title: `✅ Re-engagement sent to ${result.recipients} users!` });
      const tpl = reTemplates.find(t => t.id === selectedTemplate);
      const entry: NotificationHistory = {
        id: result.notificationId ?? Date.now().toString(),
        title: reCustomTitle || tpl?.title || 'Re-engagement',
        message: reCustomMsg || tpl?.message || '',
        recipients: result.recipients ?? 0,
        sentAt: new Date().toISOString(),
        status: 'success',
        type: 'reengagement',
      };
      const updated = [entry, ...history];
      setHistory(updated); saveHistory(updated);
      setRePendingSend(false); setReEstimate(null);
    } else {
      toast({ title: 'Send failed', description: result.error, variant: 'destructive' });
    }
  };

  const isConfigured = stats?.configured;
  const selectedTplObj = reTemplates.find(t => t.id === selectedTemplate);

  return (
    <div className="space-y-6">

      {/* ── Stats ── */}
      <Card className="bg-card shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-xl font-semibold">
              <Bell className="mr-2 h-5 w-5 text-primary" />
              Push Notification Center
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={fetchStats} disabled={statsLoading}>
              <RefreshCcw className={`h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>Send push notifications to subscribers via OneSignal.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/30 p-3 text-center">
              <Users className="mx-auto mb-1 h-5 w-5 text-primary" />
              <div className="text-2xl font-bold">
                {statsLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : (stats?.subscribers ?? '—')}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Subscribers</div>
            </div>
            <div className="rounded-lg bg-secondary/30 p-3 text-center">
              <Zap className="mx-auto mb-1 h-5 w-5 text-green-500" />
              <div className="text-2xl font-bold">{history.filter(h => h.status === 'success').length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Sent Today</div>
            </div>
            <div className="rounded-lg bg-secondary/30 p-3 text-center">
              <Globe className="mx-auto mb-1 h-5 w-5 text-blue-500" />
              <div className="text-sm font-semibold truncate mt-1">{stats?.appName || '—'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">App Name</div>
            </div>
          </div>
          {!isConfigured && !statsLoading && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>OneSignal Not Configured</AlertTitle>
              <AlertDescription className="text-xs">
                Set <code className="font-mono">NEXT_PUBLIC_ONESIGNAL_APP_ID</code> and{' '}
                <code className="font-mono">ONESIGNAL_REST_API_KEY</code> in environment variables.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="compose" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto py-1.5 mb-1">
          <TabsTrigger value="compose" className="text-xs py-2"><Send className="mr-1 h-3.5 w-3.5" />Compose</TabsTrigger>
          <TabsTrigger value="reengagement" className="text-xs py-2"><Sparkles className="mr-1 h-3.5 w-3.5" />Re-engage</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs py-2"><CalendarClock className="mr-1 h-3.5 w-3.5" />Scheduled</TabsTrigger>
        </TabsList>
        <TabsList className="grid w-full grid-cols-3 h-auto py-1.5">
          <TabsTrigger value="analytics" className="text-xs py-2" onClick={() => {
            const FIVE_MIN = 5 * 60 * 1000;
            if (!analyticsData || Date.now() - analyticsLastFetch.current > FIVE_MIN) {
              setAnalyticsLoading(true); setAnalyticsError(null);
              fetch('/api/admin/notifications/analytics?limit=20')
                .then(r => r.json())
                .then(d => { if (d.error) throw new Error(d.error); setAnalyticsData(d); analyticsLastFetch.current = Date.now(); })
                .catch(e => setAnalyticsError(e.message))
                .finally(() => setAnalyticsLoading(false));
            }
          }}><BarChart2 className="mr-1 h-3.5 w-3.5" />Analytics</TabsTrigger>
          <TabsTrigger value="history" className="text-xs py-2"><Clock className="mr-1 h-3.5 w-3.5" />History</TabsTrigger>
        </TabsList>

        {/* ── COMPOSE ── */}
        <TabsContent value="compose" className="mt-4">
          <Card className="bg-card shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center">
                <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                Compose Notification
              </CardTitle>
              <CardDescription>
                Send a push notification to subscribed devices. It appears in the phone's notification tray when web push is supported and enabled.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Kruthika 💕" maxLength={100} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Message <span className="text-destructive">*</span></Label>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Hey! I've been thinking about you... 💭"
                  maxLength={500}
                  className="min-h-[80px] text-sm resize-none"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Keep it personal & compelling</span>
                  <span>{message.length}/500</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />Large Image URL <span className="text-muted-foreground font-normal">(shown in notification body)</span>
                </Label>
                <Input
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  type="url"
                  className="text-sm"
                />
                {imageUrl.trim() && (
                  <div className="mt-1 h-20 w-full overflow-hidden rounded border bg-secondary/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="preview" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Icon URL <span className="text-muted-foreground font-normal">(small notification icon)</span></Label>
                <Input
                  value={iconUrl}
                  onChange={e => setIconUrl(e.target.value)}
                  placeholder="https://example.com/icon.png (or leave blank for default)"
                  type="url"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Click URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="/maya-chat" className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Schedule delivery <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={sendAfter}
                  min={minScheduleTime}
                  onChange={e => setSendAfter(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to send now. The time uses your device timezone and is converted to UTC before scheduling.
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Target Audience</Label>
                <div className="flex gap-2">
                  {(['all', 'tags'] as TargetMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTargetMode(mode)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        targetMode === mode
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/20 text-muted-foreground hover:bg-secondary/40'
                      }`}
                    >
                      {mode === 'all' ? <><Users className="h-3.5 w-3.5" />All Subscribers</> : <><Tag className="h-3.5 w-3.5" />By Tag</>}
                    </button>
                  ))}
                </div>
                {targetMode === 'tags' && (
                  <div className="space-y-2 rounded-lg border bg-secondary/10 p-3">
                    {tags.map((tag, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input value={tag.key} onChange={e => updateTag(i, 'key', e.target.value)} placeholder="key" className="text-xs h-8 flex-1" />
                        <select value={tag.relation} onChange={e => updateTag(i, 'relation', e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                          <option value="=">=</option><option value="!=">!=</option><option value=">">&gt;</option><option value="<">&lt;</option>
                        </select>
                        <Input value={tag.value} onChange={e => updateTag(i, 'value', e.target.value)} placeholder="value" className="text-xs h-8 flex-1" />
                        {tags.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeTag(i)}>✕</Button>}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addTag} className="text-xs">+ Add Tag</Button>
                  </div>
                )}
              </div>

              {lastResult && (
                <Alert variant={lastResult.success ? 'default' : 'destructive'}>
                  {lastResult.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{lastResult.success ? (lastResult.scheduledFor ? 'Scheduled!' : 'Sent!') : 'Failed'}</AlertTitle>
                  <AlertDescription className="text-xs">
                    {lastResult.success
                      ? lastResult.scheduledFor
                        ? `OneSignal will deliver this to all subscribed devices at ${new Date(lastResult.scheduledFor).toLocaleString()}.`
                        : `Accepted for delivery to ${lastResult.recipients} subscriber(s).`
                      : lastResult.error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Quick Templates */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Quick Templates</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: '📸 Photo chat', title: 'A visual idea for your next chat 📸', msg: 'Open Kruthika to share a photo, describe what you see, or ask for a creative take.' },
                    { label: '🎵 Voice chat', title: 'Try a voice conversation 🎵', msg: 'Send a voice message and see how Kruthika responds when you change the pace.' },
                    { label: '💭 Check in', title: 'A small check-in 💭', msg: 'Take a minute to share what is on your mind, or ask Kruthika a question.' },
                    { label: '💌 Fresh topic', title: 'Bring a new topic 💌', msg: 'Start with any idea, question, or half-formed thought and see where the conversation goes.' },
                  ].map(tpl => (
                    <button
                      key={tpl.label}
                      onClick={() => { setTitle(tpl.title); setMessage(tpl.msg); }}
                      className="text-left rounded-lg border border-border/60 bg-secondary/10 px-3 py-2.5 text-xs hover:bg-secondary/30 transition-colors"
                    >
                      <span className="font-medium">{tpl.label}</span>
                      <p className="text-muted-foreground mt-0.5 line-clamp-1">{tpl.msg}</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSend} disabled={sending || !message.trim()} className="w-full sm:w-auto">
                {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{sendAfter ? 'Scheduling…' : 'Sending…'}</> : sendAfter ? <><CalendarClock className="mr-2 h-4 w-4" />Schedule Notification</> : <><Send className="mr-2 h-4 w-4" />Send Now</>}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ── RE-ENGAGEMENT ── */}
        <TabsContent value="reengagement" className="mt-4">
          <Card className="bg-card shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center">
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                Re-engagement Notifications
              </CardTitle>
              <CardDescription>
                Send re-engagement messages to bring users back to chat. Choose an audience first — the panel shows an estimated recipient count and requires confirmation before anything is sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Template grid */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Choose a Template</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                  {reTemplates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl.id);
                        setReCustomTitle('');
                        setReCustomMsg('');
                      }}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left text-xs transition-all ${
                        selectedTemplate === tpl.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border bg-secondary/10 hover:bg-secondary/30'
                      }`}
                    >
                      <span className="text-xl mb-1">{tpl.emoji}</span>
                      <span className="font-semibold text-xs leading-tight">{tpl.label}</span>
                      <p className="mt-1 text-muted-foreground text-[10px] leading-tight line-clamp-2">{tpl.message}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview selected */}
              {selectedTplObj && !reCustomMsg && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
                  <div className="flex items-center gap-1 text-xs font-semibold text-primary"><Eye className="h-3.5 w-3.5" />Preview</div>
                  <p className="text-sm font-semibold">{reCustomTitle || selectedTplObj.title}</p>
                  <p className="text-xs text-muted-foreground">{selectedTplObj.message}</p>
                </div>
              )}

              <Separator />

              {/* Custom override */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Or Write Custom Message</Label>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Custom Title <span className="text-muted-foreground font-normal">(overrides template)</span></Label>
                  <Input value={reCustomTitle} onChange={e => setReCustomTitle(e.target.value)} placeholder={selectedTplObj?.title || "Kruthika 💕"} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Custom Message <span className="text-muted-foreground font-normal">(overrides template)</span></Label>
                  <Textarea
                    value={reCustomMsg}
                    onChange={e => setReCustomMsg(e.target.value)}
                    placeholder={selectedTplObj?.message || "Write your custom re-engagement message..."}
                    maxLength={500}
                    className="min-h-[70px] text-sm resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />Image URL</Label>
                  <Input value={reImageUrl} onChange={e => setReImageUrl(e.target.value)} placeholder="https://..." type="url" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Icon URL</Label>
                  <Input value={reIconUrl} onChange={e => setReIconUrl(e.target.value)} placeholder="https://... (optional)" type="url" className="text-sm" />
                </div>
              </div>

              {reImageUrl.trim() && (
                <div className="h-20 w-full overflow-hidden rounded border bg-secondary/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reImageUrl} alt="preview" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}

              {reResult && (
                <Alert variant={reResult.success ? 'default' : 'destructive'}>
                  {reResult.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{reResult.success ? `Sent to ${reResult.recipients} users! 🎉` : 'Failed'}</AlertTitle>
                  {!reResult.success && <AlertDescription className="text-xs">{reResult.error}</AlertDescription>}
                </Alert>
              )}

              <Separator />

              {/* ── Audience selector ── */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-1"><Users className="h-3.5 w-3.5" />Audience</Label>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {([
                    { value: 'all', label: 'All subscribers' },
                    { value: 'inactive', label: 'Inactive users' },
                    { value: 'external_ids', label: 'Specific users' },
                    { value: 'tags', label: 'Tag filters' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setReAudience(opt.value); setReEstimate(null); setRePendingSend(false); }}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
                        reAudience === opt.value
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-border bg-secondary/10 hover:bg-secondary/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {reAudience === 'inactive' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Inactive for at least (hours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={reInactiveHours}
                      onChange={e => { setReInactiveHours(Number(e.target.value) || 24); setReEstimate(null); setRePendingSend(false); }}
                      className="text-sm max-w-[200px] max-w-full"
                    />
                    <p className="text-[10px] text-muted-foreground">Users whose last chat was more than this many hours ago.</p>
                  </div>
                )}

                {reAudience === 'external_ids' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">External IDs (comma-separated)</Label>
                    <Textarea
                      value={reExternalIds}
                      onChange={e => { setReExternalIds(e.target.value); setReEstimate(null); setRePendingSend(false); }}
                      placeholder="kruthika_abc..., kruthika_def..."
                      className="text-xs min-h-[60px] resize-none"
                    />
                  </div>
                )}

                {reAudience === 'tags' && (
                  <div className="space-y-2">
                    {reTags.map((tag, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={tag.key}
                          onChange={e => { updateReTag(i, 'key', e.target.value); setReEstimate(null); setRePendingSend(false); }}
                          placeholder="tag key"
                          className="text-xs flex-1"
                        />
                        <select
                          value={tag.relation}
                          onChange={e => { updateReTag(i, 'relation', e.target.value); setReEstimate(null); setRePendingSend(false); }}
                          className="rounded-md border bg-transparent px-2 text-xs"
                        >
                          <option value="=">=</option>
                          <option value="!=">≠</option>
                          <option value="exists">exists</option>
                        </select>
                        <Input
                          value={tag.value}
                          onChange={e => { updateReTag(i, 'value', e.target.value); setReEstimate(null); setRePendingSend(false); }}
                          placeholder="value"
                          className="text-xs flex-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => { removeReTag(i); setReEstimate(null); setRePendingSend(false); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => { addReTag(); setReEstimate(null); setRePendingSend(false); }}>
                      <Tag className="mr-1 h-3 w-3" /> Add tag filter
                    </Button>
                  </div>
                )}

                {reEstimate && (
                  <Alert variant="default">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertTitle>Estimated recipients</AlertTitle>
                    <AlertDescription className="text-xs">
                      ~{reEstimate.count ?? 'unknown'} user(s){reEstimate.source ? ` (source: ${reEstimate.source})` : ''}. Review before sending.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {rePendingSend
                  ? 'Ready to send. Click "Confirm & Send" to deliver to this audience.'
                  : 'Send is two-step: estimate recipients first, then confirm.'}
              </div>
              <Button
                onClick={handleReSend}
                disabled={reSending || (!selectedTemplate && !reCustomMsg.trim())}
                className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                {reSending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{rePendingSend ? 'Sending…' : 'Estimating…'}</>
                ) : rePendingSend ? (
                  <><Send className="mr-2 h-4 w-4" />Confirm &amp; Send</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />Estimate Recipients</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ── ANALYTICS ── */}
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTabContent
            loading={analyticsLoading}
            error={analyticsError}
            data={analyticsData}
            activeView={analyticsTab}
            setActiveView={setAnalyticsTab}
            onRefresh={() => {
              setAnalyticsLoading(true); setAnalyticsError(null);
              fetch('/api/admin/notifications/analytics?limit=20')
                .then(r => r.json())
                .then(d => { if (d.error) throw new Error(d.error); setAnalyticsData(d); analyticsLastFetch.current = Date.now(); })
                .catch(e => setAnalyticsError(e.message))
                .finally(() => setAnalyticsLoading(false));
            }}
          />
        </TabsContent>

        {/* ── SCHEDULED / CRON ── */}
        <TabsContent value="scheduled" className="mt-4">
          <ScheduledCronTab
            cronWave={cronWave} setCronWave={setCronWave}
            cronImageUrl={cronImageUrl} setCronImageUrl={setCronImageUrl}
            cronFiring={cronFiring} setCronFiring={setCronFiring}
            cronResult={cronResult} setCronResult={setCronResult}
            cronPreview={cronPreview} setCronPreview={setCronPreview}
            cronPreviewLoading={cronPreviewLoading} setCronPreviewLoading={setCronPreviewLoading}
            copiedUrl={copiedUrl} setCopiedUrl={setCopiedUrl}
            history={history} setHistory={setHistory}
            toast={toast}
          />
        </TabsContent>

        {/* ── HISTORY ── */}
        <TabsContent value="history" className="mt-4">
          <Card className="bg-card shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  Notification History
                </CardTitle>
                {history.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive"
                    onClick={() => { setHistory([]); saveHistory([]); }}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No notifications sent yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                  {history.map(item => (
                    <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3 bg-secondary/10">
                      <div className="mt-0.5 shrink-0">
                        {item.status === 'success'
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <AlertCircle className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 justify-between">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="secondary" className="text-[10px]">
                              {item.type === 'reengagement' ? '🔄 re-engage' : '✉️ manual'}
                            </Badge>
                            {item.status === 'success' && (
                              <Badge variant="outline" className="text-[10px]">
                                {item.scheduledFor ? 'scheduled' : `${item.recipients} sent`}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.message}</p>
                        {item.error && <p className="text-xs text-destructive mt-0.5">{item.error}</p>}
                        <p className="text-[10px] text-muted-foreground/50 mt-1">
                          {item.scheduledFor
                            ? `Scheduled for ${new Date(item.scheduledFor).toLocaleString()}`
                            : new Date(item.sentAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── ScheduledCronTab sub-component ──────────────────────── */

const WAVES = [
  { id: 'auto', label: '🤖 Auto (IST time-aware)', desc: 'Picks morning/afternoon/evening/night automatically' },
  { id: 'morning', label: '☀️ Morning (8AM IST)', desc: 'Cheerful good morning messages' },
  { id: 'afternoon', label: '☕ Afternoon (1PM IST)', desc: 'A light break-time conversation' },
  { id: 'evening', label: '🌆 Evening (7PM IST)', desc: 'A relaxed end-of-day check-in' },
  { id: 'night', label: '🌙 Night (10PM IST)', desc: 'A calm, optional evening chat' },
];

const SEGMENT_META = [
  { id: 'warm', label: 'Warm', range: '6–24h inactive', color: 'text-green-400', desc: 'Continue a recent conversation' },
  { id: 'cooling', label: 'Cooling', range: '1–3 days', color: 'text-yellow-400', desc: 'Remind them their chat is saved' },
  { id: 'dormant', label: 'Dormant', range: '3–7 days', color: 'text-orange-400', desc: 'Offer a fresh topic or check-in' },
  { id: 'at_risk', label: 'At-Risk', range: '7–14 days', color: 'text-red-400', desc: 'Make availability clear, no pressure' },
  { id: 'lost', label: 'Lost', range: '14+ days', color: 'text-red-600', desc: 'A simple invitation to return' },
];

function ScheduledCronTab({ cronWave, setCronWave, cronImageUrl, setCronImageUrl,
  cronFiring, setCronFiring, cronResult, setCronResult,
  cronPreview, setCronPreview, cronPreviewLoading, setCronPreviewLoading,
  copiedUrl, setCopiedUrl, history, setHistory, toast }: any) {

  const cronEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/cron/reengagement`
    : '/api/cron/reengagement';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(cronEndpoint).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const handlePreview = async () => {
    setCronPreviewLoading(true);
    try {
      const cronSecret = prompt('Enter your CRON_SECRET to preview:');
      if (!cronSecret) { setCronPreviewLoading(false); return; }
      const res = await fetch('/api/cron/reengagement', {
        headers: { Authorization: `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      if (res.ok) setCronPreview(data);
      else toast({ title: 'Preview failed', description: data.error, variant: 'destructive' });
    } catch { toast({ title: 'Network error', variant: 'destructive' }); }
    finally { setCronPreviewLoading(false); }
  };

  const handleFireNow = async () => {
    const cronSecret = prompt('Enter your CRON_SECRET to fire this wave:');
    if (!cronSecret) return;
    setCronFiring(true); setCronResult(null);
    try {
      const res = await fetch('/api/cron/reengagement', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wave: cronWave,
          imageUrl: cronImageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCronResult(data);
        if (data.skipped) {
          toast({ title: '⏭️ Wave skipped', description: data.reason ?? 'Already ran today or a run is in progress.' });
          return;
        }
        toast({ title: `✅ Wave fired! ${data.summary.totalRecipients} total recipients across ${data.summary.succeeded} segments.` });
        const entry: NotificationHistory = {
          id: Date.now().toString(),
          title: `🔄 Cron: ${data.wave} wave`,
          message: `${data.summary.segmentsFired} segments fired`,
          recipients: data.summary.totalRecipients,
          sentAt: new Date().toISOString(),
          status: 'success',
          type: 'reengagement',
        };
        const updated = [entry, ...history];
        setHistory(updated);
        if (typeof window !== 'undefined') localStorage.setItem('admin_notif_history_v2', JSON.stringify(updated.slice(0, 30)));
      } else {
        setCronResult({ error: data.error });
        toast({ title: 'Fire failed', description: data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally { setCronFiring(false); }
  };

  return (
    <div className="space-y-4">
      {/* How it works */}
      <Card className="bg-card shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center">
            <CalendarClock className="mr-2 h-4 w-4 text-primary" />
            Automated Re-engagement Scheduler
          </CardTitle>
          <CardDescription>
            Fires push notifications to subscribed users, grouped by how long they've been inactive.
            Each group gets a relevant, honest message automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Audience segments */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">User Segments (sent in parallel)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SEGMENT_META.map(seg => (
                <div key={seg.id} className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-secondary/10 p-3">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${seg.color} bg-current`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{seg.label}</span>
                      <Badge variant="outline" className="text-[10px] py-0">{seg.range}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{seg.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Time waves */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Recommended Schedule (IST)</Label>
            <div className="rounded-lg border bg-secondary/10 overflow-hidden">
              {[
                { time: '08:00 IST', utc: '02:30 UTC', wave: 'morning', cron: '30 2 * * *' },
                { time: '13:00 IST', utc: '07:30 UTC', wave: 'afternoon', cron: '30 7 * * *' },
                { time: '19:00 IST', utc: '13:30 UTC', wave: 'evening', cron: '30 13 * * *' },
                { time: '22:00 IST', utc: '16:30 UTC', wave: 'night', cron: '30 16 * * *' },
              ].map((row, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${i < 3 ? 'border-b border-border/40' : ''}`}>
                  <span className="text-xs font-mono font-semibold w-20 shrink-0">{row.time}</span>
                  <code className="text-[10px] text-muted-foreground font-mono flex-1">{row.cron}</code>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{row.wave}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Cron endpoint */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Shield className="h-3 w-3" />Secure Endpoint</Label>
            <div className="flex items-center gap-2 rounded-lg border bg-secondary/20 p-3">
              <code className="flex-1 text-xs break-all text-primary font-mono">{cronEndpoint}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyUrl}>
                {copiedUrl ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <Alert className="py-2 text-xs">
              <Shield className="h-3.5 w-3.5" />
              <AlertDescription className="text-[11px] leading-relaxed">
                <strong>Setup:</strong> Set <code className="font-mono">CRON_SECRET</code> in env vars.
                Call this endpoint with header <code className="font-mono">Authorization: Bearer YOUR_CRON_SECRET</code> and body <code className="font-mono">{`{"wave":"auto"}`}</code>.
                Works with Upstash Cron, GitHub Actions, EasyCron, or Vercel Cron.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Manual fire */}
      <Card className="bg-card shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center">
            <Play className="mr-2 h-4 w-4 text-primary" />
            Fire a Wave Manually
          </CardTitle>
          <CardDescription>Test or manually trigger a wave right now — useful before setting up your cron service.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Wave</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WAVES.map(w => (
                <button
                  key={w.id}
                  onClick={() => setCronWave(w.id)}
                  className={`text-left rounded-xl border px-3 py-2.5 text-xs transition-all ${
                    cronWave === w.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-secondary/10 hover:bg-secondary/30'
                  }`}
                >
                  <div className="font-semibold">{w.label}</div>
                  <div className="text-muted-foreground mt-0.5">{w.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />Global Image URL <span className="text-muted-foreground font-normal">(optional — overrides all segments)</span></Label>
            <Input value={cronImageUrl} onChange={e => setCronImageUrl(e.target.value)} placeholder="https://... (leave blank for no image)" type="url" className="text-sm" />
            <p className="text-xs text-muted-foreground">Set <code className="font-mono">ONESIGNAL_DEFAULT_IMAGE_URL</code> in env for a permanent default image on all cron sends.</p>
          </div>

          {/* Result */}
          {cronResult && (
            <div className="rounded-xl border bg-secondary/10 p-3 space-y-2">
              <div className="flex items-center gap-2">
                {cronResult.error ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <span className="text-sm font-semibold">
                  {cronResult.error ? 'Failed' : cronResult.skipped ? `Wave "${cronResult.wave}" skipped` : `Wave "${cronResult.wave}" completed`}
                </span>
                {!cronResult.error && !cronResult.skipped && <Badge variant="secondary">{cronResult.summary?.totalRecipients} total recipients</Badge>}
              </div>
              {cronResult.skipped && <p className="text-xs text-muted-foreground">{cronResult.reason}</p>}
              {!cronResult.error && !cronResult.skipped && cronResult.results && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
                  {cronResult.results.map((r: any) => (
                    <div key={r.segment} className={`rounded-lg border p-2 text-xs ${r.success ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                      <div className="font-semibold">{r.segment}</div>
                      {r.success ? <div className="text-green-400">{r.recipients} recipients</div> : <div className="text-destructive text-[10px]">{r.error}</div>}
                    </div>
                  ))}
                </div>
              )}
              {cronResult.error && <p className="text-xs text-destructive">{cronResult.error}</p>}
            </div>
          )}

          {/* Preview */}
          {cronPreview && (
            <div className="rounded-xl border bg-secondary/10 p-3 space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Eye className="h-3 w-3" />Live Preview — Wave: {cronPreview.currentWave}</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {cronPreview.segments?.map((seg: any) => (
                  <div key={seg.segment} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{seg.label}</Badge>
                      <span className="text-[10px] text-muted-foreground">{seg.range}</span>
                    </div>
                    {seg.message ? (
                      <>
                        <p className="text-xs font-semibold">{seg.message.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{seg.message.message}</p>
                      </>
                    ) : <p className="text-[11px] text-muted-foreground italic">No message for this segment/wave</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2 flex-wrap">
          <Button onClick={handleFireNow} disabled={cronFiring} className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
            {cronFiring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Firing…</> : <><Play className="mr-2 h-4 w-4" />Fire Wave Now</>}
          </Button>
          <Button variant="outline" onClick={handlePreview} disabled={cronPreviewLoading}>
            {cronPreviewLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</> : <><Eye className="mr-2 h-4 w-4" />Preview Messages</>}
          </Button>
        </CardFooter>
      </Card>

      {/* Cron service setup guide */}
      <Card className="bg-card shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Quick Setup Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Set env vars', desc: 'Add CRON_SECRET, NEXT_PUBLIC_ONESIGNAL_APP_ID, and ONESIGNAL_REST_API_KEY to your environment.' },
              { step: '2', title: 'Choose a cron service', desc: 'Use Upstash Cron (free tier), GitHub Actions (free), EasyCron, or Vercel Cron Jobs.' },
              { step: '3', title: 'Configure 4 daily jobs', desc: 'Point each job at the endpoint above with POST method and Authorization: Bearer YOUR_CRON_SECRET header.' },
              { step: '4', title: 'Set body per job', desc: '{"wave":"morning"}, {"wave":"afternoon"}, {"wave":"evening"}, {"wave":"night"} — or use {"wave":"auto"} for one smart job.' },
              { step: '5', title: 'Test with Fire Now', desc: 'Use the "Fire Wave Now" button above to test before scheduling.' },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</div>
                <div>
                  <p className="text-xs font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── AnalyticsTabContent sub-component ───────────────────── */

const SEGMENT_COLORS: Record<string, string> = {
  warm: 'bg-green-500',
  cooling: 'bg-yellow-500',
  dormant: 'bg-orange-500',
  at_risk: 'bg-red-500',
  lost: 'bg-red-800',
  manual: 'bg-blue-500',
};

const SEGMENT_LABELS: Record<string, string> = {
  warm: '🟢 Warm (6–24h)',
  cooling: '🟡 Cooling (1–3d)',
  dormant: '🟠 Dormant (3–7d)',
  at_risk: '🔴 At-Risk (7–14d)',
  lost: '⚫ Lost (14d+)',
  manual: '✉️ Manual',
};

function AnalyticsTabContent({ loading, error, data, activeView, setActiveView, onRefresh }: {
  loading: boolean;
  error: string | null;
  data: any;
  activeView: 'overview' | 'breakdown';
  setActiveView: (v: 'overview' | 'breakdown') => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <Card className="bg-card shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Fetching analytics from OneSignal…</p>
          <p className="text-xs text-muted-foreground/60">This only loads on demand — zero impact on your site.</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card shadow-lg">
        <CardContent className="py-8 space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load analytics</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="bg-card shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <BarChart2 className="h-10 w-10 opacity-30" />
          <p className="text-sm">Open this tab to load analytics</p>
          <p className="text-xs opacity-60">Data loads lazily — no background polling</p>
        </CardContent>
      </Card>
    );
  }

  const { totals, segmentSummary, notifications, fetchedAt } = data;
  const cachedAgo = fetchedAt ? Math.round((Date.now() - fetchedAt) / 1000) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {cachedAgo < 5 ? 'Just fetched' : `Cached ${cachedAgo}s ago`} · OneSignal data
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRefresh}>
          <RefreshCcw className="mr-1.5 h-3 w-3" />Refresh
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Delivered', value: totals.delivered.toLocaleString(), icon: <Package className="h-4 w-4 text-blue-400" />, sub: 'All-time' },
          { label: 'Opened', value: totals.opened.toLocaleString(), icon: <MousePointerClick className="h-4 w-4 text-green-400" />, sub: 'Confirmed taps' },
          { label: 'Open Rate', value: `${totals.avgOpenRate}%`, icon: <TrendingUp className="h-4 w-4 text-primary" />, sub: 'Opens ÷ delivered', highlight: true },
          { label: 'Failed', value: totals.failed.toLocaleString(), icon: <AlertCircle className="h-4 w-4 text-destructive" />, sub: 'Undeliverable' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-3 ${(card as any).highlight ? 'border-primary/30 bg-primary/5' : 'bg-secondary/10'}`}>
            <div className="flex items-center gap-2 mb-1.5">{card.icon}<span className="text-[11px] text-muted-foreground">{card.label}</span></div>
            <div className="text-2xl font-bold leading-none">{card.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button variant={activeView === 'overview' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveView('overview')}>
          <BarChart2 className="mr-1.5 h-3.5 w-3.5" />By Segment
        </Button>
        <Button variant={activeView === 'breakdown' ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveView('breakdown')}>
          <Clock className="mr-1.5 h-3.5 w-3.5" />Recent Sends
        </Button>
      </div>

      {/* Segment open rate bars */}
      {activeView === 'overview' && (
        <Card className="bg-card shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />Open Rate by Segment
            </CardTitle>
            <CardDescription className="text-xs">Which user group responds best to re-engagement pushes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {segmentSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No segment data yet — fire a wave first.</p>
            ) : (
              <>
                {segmentSummary
                  .sort((a: any, b: any) => b.openRate - a.openRate)
                  .map((seg: any) => (
                    <div key={seg.segment} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{SEGMENT_LABELS[seg.segment] ?? seg.segment}</span>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{seg.opened}/{seg.delivered}</span>
                          <span className="font-bold text-foreground tabular-nums w-10 text-right">{seg.openRate}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-secondary/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${SEGMENT_COLORS[seg.segment] ?? 'bg-primary'}`}
                          style={{ width: `${Math.min(seg.openRate, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{seg.count} send{seg.count !== 1 ? 's' : ''}</p>
                    </div>
                  ))}

                {/* Benchmark note */}
                <div className="rounded-lg bg-secondary/10 border border-border/40 px-3 py-2.5 flex items-start gap-2 mt-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <strong>Guideline:</strong> Personalised, honest messages that match the user's context are more useful than fabricated urgency or fake availability. Keep each notification easy to ignore.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Per-notification breakdown */}
      {activeView === 'breakdown' && (
        <Card className="bg-card shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />Recent Sends (last 20)
            </CardTitle>
            <CardDescription className="text-xs">Per-notification delivery and open data from OneSignal</CardDescription>
          </CardHeader>
          <CardContent>
            {(!notifications || notifications.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-6">No notifications found yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                {notifications.map((n: any) => (
                  <div key={n.id} className="rounded-xl border border-border/50 bg-secondary/10 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{n.heading}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.content}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                        {n.segment}
                      </Badge>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-center">
                      {[
                        { label: 'Sent', value: n.delivered },
                        { label: 'Opened', value: n.opened, green: true },
                        { label: 'Rate', value: `${n.openRate}%`, color: n.openRate >= 10 ? 'text-green-400' : n.openRate >= 5 ? 'text-yellow-400' : 'text-muted-foreground' },
                        { label: 'Failed', value: n.failed, red: n.failed > 0 },
                      ].map(stat => (
                        <div key={stat.label} className="rounded-lg bg-background/50 py-1.5">
                          <div className={`text-sm font-bold ${(stat as any).green ? 'text-green-400' : (stat as any).red ? 'text-destructive' : (stat as any).color ?? ''}`}>
                            {stat.value}
                          </div>
                          <div className="text-[9px] text-muted-foreground">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Progress bar + date */}
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-secondary/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-primary"
                          style={{ width: `${Math.min(n.openRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {n.sentAt ? new Date(n.sentAt * 1000).toLocaleDateString('en-IN') : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
