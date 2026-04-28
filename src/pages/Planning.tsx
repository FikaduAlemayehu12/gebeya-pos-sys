// Standalone Planning module — daily / weekly / monthly / quarterly plans with
// comments, reactions, and per-plan performance tracking.
// Ported from the Netlink staff portal and adapted to this ERP's design system.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format, formatDistanceToNow, startOfWeek, endOfWeek, getISOWeek } from 'date-fns';
import {
  Target, Plus, ThumbsUp, ThumbsDown, CheckCircle2, MessageCircle,
  ChevronDown, ChevronRight, Loader2, AlertTriangle, Trophy, TrendingUp,
  Calendar as CalIcon, Clock, Flag, Pencil, Trash2,
} from 'lucide-react';

type PlanType = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type PlanStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const STATUS_COLOR: Record<PlanStatus, string> = {
  open: 'bg-secondary text-secondary-foreground',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-600',
  cancelled: 'bg-muted text-muted-foreground',
};

function periodKey(type: PlanType, date = new Date()): string {
  if (type === 'weekly') return `${date.getFullYear()}-W${String(getISOWeek(date)).padStart(2, '0')}`;
  if (type === 'monthly') return format(date, 'yyyy-MM');
  if (type === 'quarterly') return `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
  return format(date, 'yyyy-MM-dd');
}

export default function Planning() {
  const { user, profile, hasRole } = useAuth();
  const { toast } = useToast();
  const isHrStaff = hasRole('admin') || hasRole('hr_admin') || hasRole('payroll_officer');

  const [tab, setTab] = useState<'all' | PlanType>('all');
  const [plans, setPlans] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; avatar_url?: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [perfDialogPlan, setPerfDialogPlan] = useState<any>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [plansRes, profsRes] = await Promise.all([
      supabase
        .from('plans' as any)
        .select('*, plan_reactions(reaction, user_id), plan_comments(id), plan_performance_records(actual_value, planned_value, achievement_pct, status)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('profiles').select('user_id, full_name, avatar_url'),
    ]);

    const profMap: Record<string, any> = {};
    (profsRes.data || []).forEach((p: any) => {
      profMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
    });
    setProfiles(profMap);
    setPlans((plansRes.data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('planning-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_reactions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_comments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_performance_records' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const visible = useMemo(
    () => (tab === 'all' ? plans : plans.filter((p) => p.plan_type === tab)),
    [plans, tab],
  );

  const myStats = useMemo(() => {
    const mine = plans.filter((p) => p.author_id === user?.id);
    const completed = mine.filter((p) => p.status === 'completed').length;
    const overdue = mine.filter(
      (p) => p.due_date && new Date(p.due_date) < new Date() && p.status !== 'completed' && p.status !== 'cancelled',
    ).length;
    const perfRecords = mine.flatMap((p) => p.plan_performance_records || []);
    const avgAch =
      perfRecords.length > 0
        ? perfRecords.reduce((s: number, r: any) => s + Number(r.achievement_pct || 0), 0) / perfRecords.length
        : 0;
    return { total: mine.length, completed, overdue, avgAch: Math.round(avgAch) };
  }, [plans, user?.id]);

  const overdueAll = useMemo(
    () =>
      plans.filter(
        (p) => p.due_date && new Date(p.due_date) < new Date() && p.status !== 'completed' && p.status !== 'cancelled',
      ),
    [plans],
  );

  const reactsCount = (plan: any, reaction: string) =>
    (plan.plan_reactions || []).filter((r: any) => r.reaction === reaction).length;
  const myReact = (plan: any) => (plan.plan_reactions || []).find((r: any) => r.user_id === user?.id)?.reaction;

  const toggleReaction = async (planId: string, reaction: string) => {
    if (!user) return;
    const existing = plans.find((p) => p.id === planId)?.plan_reactions?.find((r: any) => r.user_id === user.id);
    if (existing?.reaction === reaction) {
      await supabase.from('plan_reactions' as any).delete().eq('plan_id', planId).eq('user_id', user.id);
    } else {
      await supabase
        .from('plan_reactions' as any)
        .upsert({ plan_id: planId, user_id: user.id, reaction } as any, { onConflict: 'plan_id,user_id' });
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Delete this plan? This action cannot be undone.')) return;
    const { error } = await supabase.from('plans' as any).delete().eq('id', planId);
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Plan deleted' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> Planning
          </h1>
          <p className="text-sm text-muted-foreground font-ethiopic">እቅድ አስተዳደር — daily, weekly &amp; quarterly plans</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> New plan
        </Button>
      </div>

      {/* SUMMARY STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={<Target className="w-4 h-4" />} label="My plans" value={myStats.total} />
        <StatTile icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} label="Completed" value={myStats.completed} tone="success" />
        <StatTile icon={<Flag className="w-4 h-4 text-destructive" />} label="My overdue" value={myStats.overdue} tone={myStats.overdue > 0 ? 'danger' : 'default'} />
        <StatTile icon={<TrendingUp className="w-4 h-4 text-primary" />} label="Avg achievement" value={`${myStats.avgAch}%`} />
      </div>

      {overdueAll.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Overdue milestones ({overdueAll.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-44 overflow-y-auto pt-0">
            {overdueAll.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px]">{PLAN_TYPE_LABEL[p.plan_type as PlanType]}</Badge>
                  <span className="truncate">{p.title}</span>
                </div>
                <span className="text-destructive font-mono shrink-0">
                  due {formatDistanceToNow(new Date(p.due_date), { addSuffix: true })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TABS */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No plans yet. Click <span className="font-medium">New plan</span> to add one.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visible.map((p) => {
                const author = profiles[p.author_id];
                const isMine = p.author_id === user?.id;
                const canEdit = isMine || isHrStaff;
                const isExpanded = expanded === p.id;
                const perf = (p.plan_performance_records || [])[0];
                const overdue = p.due_date && new Date(p.due_date) < new Date() && p.status !== 'completed' && p.status !== 'cancelled';

                return (
                  <Card key={p.id} className={overdue ? 'border-destructive/30' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarFallback className="text-xs">
                            {(author?.full_name || '?').split(' ').map((s) => s[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm">{p.title}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {PLAN_TYPE_LABEL[p.plan_type as PlanType]}
                            </Badge>
                            <Badge className={`text-[10px] capitalize border-0 ${STATUS_COLOR[p.status as PlanStatus]}`}>
                              {p.status.replace('_', ' ')}
                            </Badge>
                            {overdue && <Badge variant="destructive" className="text-[10px]">overdue</Badge>}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>{author?.full_name || 'Unknown'}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                            {p.due_date && (
                              <span className="flex items-center gap-1"><CalIcon className="w-3 h-3" />due {format(new Date(p.due_date), 'MMM d')}</span>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(p); setShowForm(true); }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deletePlan(p.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">{p.content}</p>

                      {perf && (
                        <div className="rounded-md border bg-muted/40 p-2.5">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="flex items-center gap-1 font-medium"><Trophy className="w-3.5 h-3.5 text-primary" />Achievement</span>
                            <span className="font-mono">{Number(perf.actual_value)}/{Number(perf.planned_value)} · {Math.round(Number(perf.achievement_pct || 0))}%</span>
                          </div>
                          <Progress value={Math.min(100, Number(perf.achievement_pct || 0))} className="h-1.5" />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5">
                        <ReactionBtn active={myReact(p) === 'thumbs_up'} count={reactsCount(p, 'thumbs_up')} icon={<ThumbsUp className="w-3.5 h-3.5" />} onClick={() => toggleReaction(p.id, 'thumbs_up')} />
                        <ReactionBtn active={myReact(p) === 'thumbs_down'} count={reactsCount(p, 'thumbs_down')} icon={<ThumbsDown className="w-3.5 h-3.5" />} onClick={() => toggleReaction(p.id, 'thumbs_down')} />
                        <ReactionBtn active={myReact(p) === 'acknowledge'} count={reactsCount(p, 'acknowledge')} icon={<CheckCircle2 className="w-3.5 h-3.5" />} onClick={() => toggleReaction(p.id, 'acknowledge')} />

                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setExpanded(isExpanded ? null : p.id)}>
                          <MessageCircle className="w-3.5 h-3.5" />
                          {(p.plan_comments || []).length} comments
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </Button>

                        {isMine && (
                          <Button size="sm" variant="outline" className="h-7 ml-auto text-xs gap-1" onClick={() => setPerfDialogPlan(p)}>
                            <Trophy className="w-3.5 h-3.5" /> Record performance
                          </Button>
                        )}
                      </div>

                      {isExpanded && <CommentThread planId={p.id} profiles={profiles} currentUserId={user?.id} />}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showForm && (
        <PlanFormDialog
          plan={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          authorName={profile?.full_name || 'You'}
        />
      )}

      {perfDialogPlan && (
        <PerformanceDialog plan={perfDialogPlan} onClose={() => setPerfDialogPlan(null)} />
      )}
    </div>
  );
}

// ====================== SUB-COMPONENTS ======================

function StatTile({
  icon, label, value, tone = 'default',
}: { icon: React.ReactNode; label: string; value: number | string; tone?: 'default' | 'success' | 'danger' }) {
  const toneCls = tone === 'success' ? 'border-emerald-500/30' : tone === 'danger' ? 'border-destructive/40' : '';
  return (
    <Card className={toneCls}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function ReactionBtn({
  active, count, icon, onClick,
}: { active: boolean; count: number; icon: React.ReactNode; onClick: () => void }) {
  return (
    <Button size="sm" variant={active ? 'secondary' : 'ghost'} className="h-7 gap-1 text-xs" onClick={onClick}>
      {icon}
      <span>{count}</span>
    </Button>
  );
}

// ----- Comment thread -----
function CommentThread({ planId, profiles, currentUserId }: { planId: string; profiles: any; currentUserId: string | undefined }) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const { data } = await supabase.from('plan_comments' as any).select('*').eq('plan_id', planId).order('created_at');
    setComments((data as any[]) || []);
    setLoading(false);
  }, [planId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!text.trim() || !currentUserId) return;
    const { error } = await supabase.from('plan_comments' as any).insert({
      plan_id: planId, author_id: currentUserId, content: text.trim(),
    } as any);
    if (error) {
      toast({ title: 'Could not post comment', description: error.message, variant: 'destructive' });
      return;
    }
    setText('');
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('plan_comments' as any).delete().eq('id', id);
    load();
  };

  return (
    <div className="border-t pt-3 space-y-2">
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : comments.length === 0 ? (
        <div className="text-xs text-muted-foreground">No comments yet.</div>
      ) : (
        comments.map((c) => {
          const author = profiles[c.author_id];
          const mine = c.author_id === currentUserId;
          return (
            <div key={c.id} className="flex gap-2 text-sm">
              <Avatar className="w-6 h-6 shrink-0"><AvatarFallback className="text-[10px]">{(author?.full_name || '?')[0]}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{author?.full_name || 'Unknown'}</span>
                  <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  {mine && (
                    <button className="text-destructive hover:underline ml-auto" onClick={() => remove(c.id)}>delete</button>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{c.content}</div>
              </div>
            </div>
          );
        })
      )}
      <div className="flex gap-2 pt-1">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(); }} />
        <Button size="sm" onClick={submit} disabled={!text.trim()}>Post</Button>
      </div>
    </div>
  );
}

// ----- Plan form -----
function PlanFormDialog({
  plan, onClose, authorName,
}: { plan: any | null; onClose: () => void; authorName: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: plan?.title || '',
    content: plan?.content || '',
    plan_type: (plan?.plan_type as PlanType) || 'daily',
    status: (plan?.status as PlanStatus) || 'open',
    due_date: plan?.due_date || '',
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Title and content are required', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setBusy(true);
    const payload: any = {
      title: form.title.trim(),
      content: form.content.trim(),
      plan_type: form.plan_type,
      status: form.status,
      due_date: form.due_date || null,
    };

    if (plan) {
      const { error } = await supabase.from('plans' as any).update(payload).eq('id', plan.id);
      if (error) {
        toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
        setBusy(false);
        return;
      }
      toast({ title: 'Plan updated' });
    } else {
      const { data, error } = await supabase
        .from('plans' as any)
        .insert({ ...payload, author_id: user.id } as any)
        .select()
        .single();
      if (error) {
        toast({ title: 'Could not create plan', description: error.message, variant: 'destructive' });
        setBusy(false);
        return;
      }
      // Seed a performance record so the tracker has something to update
      await supabase.from('plan_performance_records' as any).upsert({
        staff_id: user.id,
        plan_id: (data as any).id,
        plan_type: form.plan_type,
        period_key: periodKey(form.plan_type),
        planned_value: 100,
        actual_value: 0,
        status: 'pending',
      } as any, { onConflict: 'staff_id,plan_id' });
      toast({ title: 'Plan submitted', description: `Authored by ${authorName}` });
    }
    setBusy(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{plan ? 'Edit plan' : 'New plan'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.plan_type} onValueChange={(v) => setForm({ ...form, plan_type: v as PlanType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PlanStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q3 sales push" />
          </div>
          <div>
            <Label>Content</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              placeholder="Describe the plan, milestones, and expected outcomes…"
            />
          </div>
          <div>
            <Label>Due date (optional)</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
            {plan ? 'Save changes' : 'Submit plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Performance dialog -----
function PerformanceDialog({ plan, onClose }: { plan: any; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const existing = (plan.plan_performance_records || [])[0];
  const [planned, setPlanned] = useState(String(existing?.planned_value ?? 100));
  const [actual, setActual] = useState(String(existing?.actual_value ?? ''));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const p = parseFloat(planned), a = parseFloat(actual);
    if (isNaN(p) || isNaN(a) || p <= 0 || a < 0 || a > p * 2) {
      toast({ title: 'Enter valid planned and actual values', variant: 'destructive' });
      return;
    }
    if (!user) return;
    setBusy(true);
    const ach = (a / p) * 100;
    const grade = Math.min(100, Math.round(ach));
    const flagged = ach < 60;
    const { error } = await supabase.from('plan_performance_records' as any).upsert({
      staff_id: user.id,
      plan_id: plan.id,
      plan_type: plan.plan_type,
      period_key: periodKey(plan.plan_type as PlanType),
      planned_value: p,
      actual_value: a,
      grade,
      flagged,
      status: 'recorded',
    } as any, { onConflict: 'staff_id,plan_id' });
    setBusy(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Performance recorded', description: `${Math.round(ach)}% achievement` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record performance</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Plan: <span className="text-foreground font-medium">{plan.title}</span></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Planned</Label>
              <Input type="number" min="1" value={planned} onChange={(e) => setPlanned(e.target.value)} />
            </div>
            <div>
              <Label>Actual</Label>
              <Input type="number" min="0" value={actual} onChange={(e) => setActual(e.target.value)} />
            </div>
          </div>
          {!isNaN(parseFloat(actual)) && parseFloat(planned) > 0 && (
            <div className="text-xs text-muted-foreground">
              Achievement: <span className="text-foreground font-mono">{Math.round((parseFloat(actual) / parseFloat(planned)) * 100)}%</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
