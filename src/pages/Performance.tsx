import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

type KPI = { id: string; code: string; name: string; unit: string | null; weight_pct: number; target: number | null; direction: string };
type Cycle = { id: string; name: string; period_start: string; period_end: string; status: string };
type Review = { id: string; cycle_id: string; employee_id: string; self_score: number | null; manager_score: number | null; peer_score: number | null; final_score: number | null; rating: string | null; status: string; kpi_scores: any[] };
type Goal = { id: string; employee_id: string; cycle_id: string | null; title: string; target_value: number | null; achieved_value: number; weight_pct: number; due_date: string | null; status: string };

export default function Performance() {
  const { user } = useAuth();
  const [tab, setTab] = useState('reviews');
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [myEmpId, setMyEmpId] = useState<string | null>(null);

  const [kpiOpen, setKpiOpen] = useState(false);
  const [kpiDraft, setKpiDraft] = useState<Partial<KPI>>({});
  const [cycleOpen, setCycleOpen] = useState(false);
  const [cycleDraft, setCycleDraft] = useState<Partial<Cycle>>({});
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<Partial<Goal>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    const [k, c, r, g, e] = await Promise.all([
      supabase.from('kpi_definitions').select('*').order('code'),
      supabase.from('review_cycles').select('*').order('period_start', { ascending: false }),
      supabase.from('performance_reviews').select('*'),
      supabase.from('goals').select('*').order('due_date'),
      supabase.from('employees').select('id, full_name, user_id, position').eq('status', 'active'),
    ]);
    setKpis((k.data || []) as any);
    setCycles((c.data || []) as any);
    setReviews((r.data || []) as any);
    setGoals((g.data || []) as any);
    setEmployees(e.data || []);
    const me = (e.data || []).find((x: any) => x.user_id === user?.id);
    setMyEmpId(me?.id || null);
  }

  const kpiWeightTotal = kpis.reduce((s, k) => s + Number(k.weight_pct || 0), 0);

  async function saveKpi() {
    if (!kpiDraft.code || !kpiDraft.name) { toast.error('Code & name required'); return; }
    const { error } = await supabase.from('kpi_definitions').insert(kpiDraft as any);
    if (error) return toast.error(error.message);
    toast.success('KPI added'); setKpiOpen(false); setKpiDraft({}); load();
  }

  async function saveCycle() {
    if (!cycleDraft.name || !cycleDraft.period_start || !cycleDraft.period_end) { toast.error('All fields required'); return; }
    const { error } = await supabase.from('review_cycles').insert(cycleDraft as any);
    if (error) return toast.error(error.message);
    toast.success('Cycle created'); setCycleOpen(false); setCycleDraft({}); load();
  }

  async function saveGoal() {
    if (!goalDraft.title || !goalDraft.employee_id) { toast.error('Title & employee required'); return; }
    const { error } = await supabase.from('goals').insert(goalDraft as any);
    if (error) return toast.error(error.message);
    toast.success('Goal set'); setGoalOpen(false); setGoalDraft({}); load();
  }

  async function updateReview(id: string, patch: Partial<Review>) {
    // auto-compute final
    if (patch.self_score !== undefined || patch.manager_score !== undefined || patch.peer_score !== undefined) {
      const r = reviews.find((x) => x.id === id);
      const s = patch.self_score ?? r?.self_score ?? 0;
      const m = patch.manager_score ?? r?.manager_score ?? 0;
      const p = patch.peer_score ?? r?.peer_score ?? 0;
      const scores = [s, m, p].filter((x) => x !== null && x !== 0);
      const final = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : null;
      patch.final_score = final;
      patch.rating = final === null ? null : final >= 4.5 ? 'Exceeds' : final >= 3.5 ? 'Meets' : final >= 2.5 ? 'Developing' : 'Below';
    }
    const { error } = await supabase.from('performance_reviews').update(patch).eq('id', id);
    if (error) return toast.error(error.message);
    load();
  }

  async function ensureReview(cycleId: string, employeeId: string) {
    const existing = reviews.find((r) => r.cycle_id === cycleId && r.employee_id === employeeId);
    if (existing) return existing.id;
    const { data, error } = await supabase.from('performance_reviews')
      .insert({ cycle_id: cycleId, employee_id: employeeId, status: 'draft', kpi_scores: [] })
      .select().single();
    if (error) { toast.error(error.message); return null; }
    load();
    return data.id;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6" /> Performance Management</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="kpis">KPI Library</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Performance Reviews</CardTitle>
              <Select onValueChange={(cid) => { const emp = employees[0]; if (emp) ensureReview(cid, emp.id); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Start review in cycle..." /></SelectTrigger>
                <SelectContent>{cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-2">Employee</th><th>Cycle</th><th>Self</th><th>Manager</th><th>Peer</th><th>Final</th><th>Rating</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {reviews.map((r) => {
                    const emp = employees.find((e) => e.id === r.employee_id);
                    const cyc = cycles.find((c) => c.id === r.cycle_id);
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30">
                        <td className="p-2">{emp?.full_name || '—'}</td>
                        <td>{cyc?.name || '—'}</td>
                        <td><Input type="number" step="0.1" defaultValue={r.self_score ?? ''} className="h-7 w-16" onBlur={(e) => updateReview(r.id, { self_score: e.target.value ? Number(e.target.value) : null })} /></td>
                        <td><Input type="number" step="0.1" defaultValue={r.manager_score ?? ''} className="h-7 w-16" onBlur={(e) => updateReview(r.id, { manager_score: e.target.value ? Number(e.target.value) : null })} /></td>
                        <td><Input type="number" step="0.1" defaultValue={r.peer_score ?? ''} className="h-7 w-16" onBlur={(e) => updateReview(r.id, { peer_score: e.target.value ? Number(e.target.value) : null })} /></td>
                        <td className="font-semibold">{r.final_score?.toFixed(2) || '—'}</td>
                        <td>{r.rating && <Badge>{r.rating}</Badge>}</td>
                        <td><Badge variant="outline">{r.status}</Badge></td>
                      </tr>
                    );
                  })}
                  {!reviews.length && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">No reviews yet.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>SMART Goals</CardTitle>
              <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Goal</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Select value={goalDraft.employee_id} onValueChange={(v) => setGoalDraft({ ...goalDraft, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Title" value={goalDraft.title || ''} onChange={(e) => setGoalDraft({ ...goalDraft, title: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Target" value={goalDraft.target_value ?? ''} onChange={(e) => setGoalDraft({ ...goalDraft, target_value: Number(e.target.value) })} />
                      <Input type="number" placeholder="Weight %" value={goalDraft.weight_pct ?? ''} onChange={(e) => setGoalDraft({ ...goalDraft, weight_pct: Number(e.target.value) })} />
                    </div>
                    <Input type="date" value={goalDraft.due_date || ''} onChange={(e) => setGoalDraft({ ...goalDraft, due_date: e.target.value })} />
                  </div>
                  <DialogFooter><Button onClick={saveGoal}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {goals.map((g) => {
                const emp = employees.find((e) => e.id === g.employee_id);
                const pct = g.target_value ? Math.min(100, (Number(g.achieved_value) / Number(g.target_value)) * 100) : 0;
                return (
                  <div key={g.id} className="border rounded-lg p-3 space-y-1">
                    <div className="flex justify-between"><div className="font-medium text-sm">{g.title}</div><Badge variant="outline">{g.status}</Badge></div>
                    <div className="text-xs text-muted-foreground">{emp?.full_name} · Due {g.due_date || '—'}</div>
                    <div className="h-2 bg-muted rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                    <div className="text-xs">{g.achieved_value} / {g.target_value} ({pct.toFixed(0)}%)</div>
                  </div>
                );
              })}
              {!goals.length && <div className="col-span-full text-center py-8 text-muted-foreground text-sm">No goals yet.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Review Cycles</CardTitle>
              <Dialog open={cycleOpen} onOpenChange={setCycleOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Cycle</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Cycle</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Input placeholder="Name (e.g., Q1 2026)" value={cycleDraft.name || ''} onChange={(e) => setCycleDraft({ ...cycleDraft, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="date" value={cycleDraft.period_start || ''} onChange={(e) => setCycleDraft({ ...cycleDraft, period_start: e.target.value })} />
                      <Input type="date" value={cycleDraft.period_end || ''} onChange={(e) => setCycleDraft({ ...cycleDraft, period_end: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button onClick={saveCycle}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Name</th><th>Period</th><th>Status</th></tr></thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="p-2 font-medium">{c.name}</td>
                      <td>{c.period_start} → {c.period_end}</td>
                      <td>
                        <Select value={c.status} onValueChange={async (v) => { await supabase.from('review_cycles').update({ status: v }).eq('id', c.id); load(); }}>
                          <SelectTrigger className="h-7 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>{['draft','open','calibration','closed'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>KPI Library</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Total weight: <span className={kpiWeightTotal > 100 ? 'text-destructive font-semibold' : ''}>{kpiWeightTotal}%</span> {kpiWeightTotal > 100 && '(exceeds 100%)'}</p>
              </div>
              <Dialog open={kpiOpen} onOpenChange={setKpiOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add KPI</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New KPI</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Code" value={kpiDraft.code || ''} onChange={(e) => setKpiDraft({ ...kpiDraft, code: e.target.value.toUpperCase() })} />
                      <Input placeholder="Unit (%, hrs, ETB)" value={kpiDraft.unit || ''} onChange={(e) => setKpiDraft({ ...kpiDraft, unit: e.target.value })} />
                    </div>
                    <Input placeholder="Name" value={kpiDraft.name || ''} onChange={(e) => setKpiDraft({ ...kpiDraft, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Weight %" value={kpiDraft.weight_pct ?? ''} onChange={(e) => setKpiDraft({ ...kpiDraft, weight_pct: Number(e.target.value) })} />
                      <Input type="number" placeholder="Target" value={kpiDraft.target ?? ''} onChange={(e) => setKpiDraft({ ...kpiDraft, target: Number(e.target.value) })} />
                    </div>
                    <Select value={kpiDraft.direction} onValueChange={(v) => setKpiDraft({ ...kpiDraft, direction: v })}>
                      <SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger>
                      <SelectContent><SelectItem value="higher">Higher is better</SelectItem><SelectItem value="lower">Lower is better</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button onClick={saveKpi}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Code</th><th>Name</th><th>Unit</th><th>Weight</th><th>Target</th><th>Dir.</th></tr></thead>
                <tbody>
                  {kpis.map((k) => (
                    <tr key={k.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{k.code}</td><td>{k.name}</td>
                      <td>{k.unit || '—'}</td><td>{k.weight_pct}%</td>
                      <td>{k.target ?? '—'}</td><td>{k.direction === 'higher' ? '↑' : '↓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
