import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import StatCard from '@/components/StatCard';
import { Building2, Plus, MapPin, Phone, TrendingUp, Wallet, ArrowLeftRight, Target, Users, Banknote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Branch = {
  id: string; name: string; code: string; address: string; city: string; phone: string; is_active: boolean; region?: string;
  tin_number?: string; vat_number?: string; business_license?: string;
  default_bank_account_id?: string | null; gl_cost_center?: string; profit_center?: string;
  default_warehouse?: string; stock_location?: string;
  timezone?: string; currency?: string;
  doc_prefix_invoice?: string; doc_prefix_po?: string; doc_prefix_receipt?: string;
  manager_user_id?: string | null;
};

const EMPTY_BRANCH = {
  name:'', code:'', address:'', city:'', phone:'', region:'',
  tin_number:'', vat_number:'', business_license:'',
  default_bank_account_id:'', gl_cost_center:'', profit_center:'',
  default_warehouse:'', stock_location:'',
  timezone:'Africa/Addis_Ababa', currency:'ETB',
  doc_prefix_invoice:'INV', doc_prefix_po:'PO', doc_prefix_receipt:'RCT',
  manager_user_id:'',
};

const fmt = (n: number) => `ETB ${Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function Branches() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" /> Branches</h1>
        <p className="text-sm text-muted-foreground mt-1">Multi-branch operations: directory, performance, cash, transfers, targets and regional roll-up.</p>
      </div>

      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="cash">Cash Position</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="targets">Targets</TabsTrigger>
          <TabsTrigger value="regional">Regional Roll-up</TabsTrigger>
        </TabsList>

        <TabsContent value="directory"><DirectoryTab /></TabsContent>
        <TabsContent value="performance"><PerformanceTab /></TabsContent>
        <TabsContent value="cash"><CashTab /></TabsContent>
        <TabsContent value="transfers"><TransfersTab /></TabsContent>
        <TabsContent value="targets"><TargetsTab /></TabsContent>
        <TabsContent value="regional"><RegionalTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────── Directory ───────── */
function DirectoryTab() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name:'', code:'', address:'', city:'', phone:'', region:'' });

  const load = async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    setBranches((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name || !form.code) { toast({ title: 'Name and code required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('branches').insert(form as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Branch created' }); setOpen(false); setForm({ name:'', code:'', address:'', city:'', phone:'', region:'' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Branch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BR-001" /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Addis / North / South" /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={add}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.length === 0 && <Card className="md:col-span-2 lg:col-span-3"><CardContent className="py-12 text-center text-muted-foreground">No branches yet.</CardContent></Card>}
        {branches.map(b => (
          <Card key={b.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{b.code} {b.region && `· ${b.region}`}</p>
                </div>
                <Badge variant="secondary" className={b.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>
                  {b.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {b.city && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {b.city}{b.address && `, ${b.address}`}</div>}
              {b.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" /> {b.phone}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────── Performance comparison ───────── */
function PerformanceTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<Record<string, { sales: number; orders: number; customers: number }>>({});
  const [days, setDays] = useState(30);

  const load = async () => {
    const since = new Date(); since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();
    const [b, s] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('sales').select('branch_id,total,customer_id').gte('created_at', sinceISO),
    ]);
    const all = (b.data as any[]) || [];
    setBranches(all);
    const map: any = {};
    all.forEach(br => map[br.id] = { sales: 0, orders: 0, customers: new Set() });
    ((s.data as any[]) || []).forEach(r => {
      if (!r.branch_id || !map[r.branch_id]) return;
      map[r.branch_id].sales += Number(r.total || 0);
      map[r.branch_id].orders += 1;
      if (r.customer_id) map[r.branch_id].customers.add(r.customer_id);
    });
    const out: any = {};
    Object.entries(map).forEach(([k, v]: any) => { out[k] = { sales: v.sales, orders: v.orders, customers: v.customers.size }; });
    setStats(out);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const total = Object.values(stats).reduce((s, x) => s + x.sales, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Performance comparison</CardTitle>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>Region</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Customers</TableHead><TableHead>Share</TableHead></TableRow></TableHeader>
          <TableBody>
            {branches.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No branches.</TableCell></TableRow>}
            {branches.map(b => {
              const s = stats[b.id] || { sales:0, orders:0, customers:0 };
              const pct = total ? Math.round((s.sales/total)*100) : 0;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.region || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(s.sales)}</TableCell>
                  <TableCell className="text-right">{s.orders}</TableCell>
                  <TableCell className="text-right">{s.customers}</TableCell>
                  <TableCell className="w-40"><Progress value={pct} className="h-2" /><span className="text-xs text-muted-foreground">{pct}%</span></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───────── Cash position ───────── */
function CashTab() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ branch_id:'', cash_balance:'', petty_cash:'', bank_balance:'', expected_deposit:'', shortage:'', overage:'', notes:'' });

  const load = async () => {
    const [b, p] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('branch_cash_positions' as any).select('*').order('snapshot_date', { ascending: false }).limit(100),
    ]);
    setBranches((b.data as any) || []); setPositions((p.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.branch_id) { toast({ title: 'Pick a branch', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('branch_cash_positions' as any).insert({
      ...form,
      cash_balance: Number(form.cash_balance||0), petty_cash: Number(form.petty_cash||0),
      bank_balance: Number(form.bank_balance||0), expected_deposit: Number(form.expected_deposit||0),
      shortage: Number(form.shortage||0), overage: Number(form.overage||0),
      recorded_by: user?.id,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Snapshot recorded' }); setOpen(false);
    setForm({ branch_id:'', cash_balance:'', petty_cash:'', bank_balance:'', expected_deposit:'', shortage:'', overage:'', notes:'' }); load();
  };

  // latest per branch
  const latest = useMemo(() => {
    const out: any = {};
    positions.forEach(p => { if (!out[p.branch_id] || out[p.branch_id].snapshot_date < p.snapshot_date) out[p.branch_id] = p; });
    return out;
  }, [positions]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Record snapshot</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cash position snapshot</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Cash on hand</Label><Input type="number" value={form.cash_balance} onChange={(e) => setForm({ ...form, cash_balance: e.target.value })} /></div>
                <div><Label>Petty cash</Label><Input type="number" value={form.petty_cash} onChange={(e) => setForm({ ...form, petty_cash: e.target.value })} /></div>
                <div><Label>Bank balance</Label><Input type="number" value={form.bank_balance} onChange={(e) => setForm({ ...form, bank_balance: e.target.value })} /></div>
                <div><Label>Expected deposit</Label><Input type="number" value={form.expected_deposit} onChange={(e) => setForm({ ...form, expected_deposit: e.target.value })} /></div>
                <div><Label>Shortage</Label><Input type="number" value={form.shortage} onChange={(e) => setForm({ ...form, shortage: e.target.value })} /></div>
                <div><Label>Overage</Label><Input type="number" value={form.overage} onChange={(e) => setForm({ ...form, overage: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="w-4 h-4" /> Live cash position by branch</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>As of</TableHead><TableHead className="text-right">Cash</TableHead><TableHead className="text-right">Petty</TableHead><TableHead className="text-right">Bank</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Variance</TableHead></TableRow></TableHeader>
            <TableBody>
              {branches.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No branches.</TableCell></TableRow>}
              {branches.map(b => {
                const p = latest[b.id];
                const variance = p ? Number(p.overage||0) - Number(p.shortage||0) : 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-xs">{p?.snapshot_date || '—'}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p?.cash_balance || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p?.petty_cash || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p?.bank_balance || 0)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p?.expected_deposit || 0)}</TableCell>
                    <TableCell className={`text-right font-mono ${variance < 0 ? 'text-destructive' : variance > 0 ? 'text-success' : ''}`}>{fmt(variance)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── Resource transfers (cash/asset/staff) ───────── */
function TransfersTab() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ transfer_code:'', resource_type:'cash', source_branch_id:'', destination_branch_id:'', amount:'', reason:'' });

  const load = async () => {
    const [b, r] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('branch_resource_transfers' as any).select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setBranches((b.data as any) || []); setRows((r.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.transfer_code || !form.source_branch_id || !form.destination_branch_id) { toast({ title: 'Code & branches required', variant: 'destructive' }); return; }
    if (form.source_branch_id === form.destination_branch_id) { toast({ title: 'Source and destination must differ', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('branch_resource_transfers' as any).insert({ ...form, amount: Number(form.amount||0), created_by: user?.id } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Transfer requested' }); setOpen(false); setForm({ transfer_code:'', resource_type:'cash', source_branch_id:'', destination_branch_id:'', amount:'', reason:'' }); load();
  };

  const update = async (id: string, patch: any) => {
    await supabase.from('branch_resource_transfers' as any).update(patch as any).eq('id', id);
    load();
  };

  const colorMap: Record<string,string> = { pending:'bg-warning/15 text-warning-foreground', approved:'bg-info/15 text-info', received:'bg-success/15 text-success', cancelled:'bg-destructive/15 text-destructive' };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /> Inter-branch transfers (cash · staff · assets)</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New transfer</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New transfer</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={form.transfer_code} onChange={(e) => setForm({ ...form, transfer_code: e.target.value })} placeholder="TRF-2026-001" /></div>
                <div><Label>Type</Label>
                  <Select value={form.resource_type} onValueChange={(v) => setForm({ ...form, resource_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="asset">Asset</SelectItem><SelectItem value="staff">Staff</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>From</Label>
                  <Select value={form.source_branch_id} onValueChange={(v) => setForm({ ...form, source_branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>To</Label>
                  <Select value={form.destination_branch_id} onValueChange={(v) => setForm({ ...form, destination_branch_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {form.resource_type === 'cash' && <div><Label>Amount (ETB)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>}
              <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>From → To</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transfers yet.</TableCell></TableRow>}
            {rows.map(r => {
              const src = branches.find(b => b.id === r.source_branch_id)?.name || '—';
              const dst = branches.find(b => b.id === r.destination_branch_id)?.name || '—';
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.transfer_code}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.resource_type}</Badge></TableCell>
                  <TableCell className="text-xs">{src} → {dst}</TableCell>
                  <TableCell className="text-right font-mono">{r.resource_type === 'cash' ? fmt(Number(r.amount)) : '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className={colorMap[r.status]}>{r.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {r.status === 'pending' && <>
                      <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => update(r.id, { status:'approved', approved_at: new Date().toISOString() })}>Approve</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => update(r.id, { status:'cancelled' })}>Cancel</Button>
                    </>}
                    {r.status === 'approved' && <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => update(r.id, { status:'received', received_at: new Date().toISOString() })}>Mark received</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───────── Targets ───────── */
function TargetsTab() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [actuals, setActuals] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({ branch_id:'', period_year: String(now.getFullYear()), period_month: String(now.getMonth()+1), sales_target:'', profit_target:'', collections_target:'', customer_target:'', expense_cap:'' });

  const load = async () => {
    const [b, t] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('branch_targets' as any).select('*').eq('period_year', now.getFullYear()).eq('period_month', now.getMonth()+1),
    ]);
    setBranches((b.data as any) || []); setTargets((t.data as any) || []);

    // current month sales
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: s } = await supabase.from('sales').select('branch_id,total').gte('created_at', start);
    const map: Record<string, number> = {};
    ((s as any[])||[]).forEach(r => { if (r.branch_id) map[r.branch_id] = (map[r.branch_id]||0) + Number(r.total||0); });
    setActuals(map);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!form.branch_id) { toast({ title: 'Pick a branch', variant: 'destructive' }); return; }
    const payload = { ...form, period_year: Number(form.period_year), period_month: Number(form.period_month),
      sales_target: Number(form.sales_target||0), profit_target: Number(form.profit_target||0),
      collections_target: Number(form.collections_target||0), customer_target: Number(form.customer_target||0),
      expense_cap: Number(form.expense_cap||0) };
    const { error } = await supabase.from('branch_targets' as any).upsert(payload as any, { onConflict: 'branch_id,period_year,period_month' } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Target saved' }); setOpen(false); load();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Target className="w-4 h-4" /> Branch targets — {now.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Set target</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Set monthly target</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Year</Label><Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: e.target.value })} /></div>
                <div><Label>Month</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sales target (ETB)</Label><Input type="number" value={form.sales_target} onChange={(e) => setForm({ ...form, sales_target: e.target.value })} /></div>
                <div><Label>Profit target</Label><Input type="number" value={form.profit_target} onChange={(e) => setForm({ ...form, profit_target: e.target.value })} /></div>
                <div><Label>Collections target</Label><Input type="number" value={form.collections_target} onChange={(e) => setForm({ ...form, collections_target: e.target.value })} /></div>
                <div><Label>New customers</Label><Input type="number" value={form.customer_target} onChange={(e) => setForm({ ...form, customer_target: e.target.value })} /></div>
                <div className="col-span-2"><Label>Expense cap</Label><Input type="number" value={form.expense_cap} onChange={(e) => setForm({ ...form, expense_cap: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead className="text-right">Sales target</TableHead><TableHead className="text-right">Actual</TableHead><TableHead>Progress</TableHead></TableRow></TableHeader>
          <TableBody>
            {branches.map(b => {
              const t = targets.find(x => x.branch_id === b.id);
              const target = Number(t?.sales_target || 0);
              const actual = actuals[b.id] || 0;
              const pct = target ? Math.min(100, Math.round((actual/target)*100)) : 0;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-right font-mono">{target ? fmt(target) : '—'}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(actual)}</TableCell>
                  <TableCell className="w-48"><Progress value={pct} className="h-2" />
                    <span className={`text-xs ${pct < 50 ? 'text-destructive' : pct < 80 ? 'text-warning-foreground' : 'text-success'}`}>{pct}%</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───────── Regional roll-up ───────── */
function RegionalTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});

  const load = async () => {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const [b, s] = await Promise.all([
      supabase.from('branches').select('*'),
      supabase.from('sales').select('branch_id,total').gte('created_at', since.toISOString()),
    ]);
    setBranches((b.data as any) || []);
    const map: Record<string, number> = {};
    ((s.data as any[])||[]).forEach(r => { if (r.branch_id) map[r.branch_id] = (map[r.branch_id]||0) + Number(r.total||0); });
    setStats(map);
  };
  useEffect(() => { load(); }, []);

  const regions = useMemo(() => {
    const groups: Record<string, { sales: number; branches: number }> = {};
    branches.forEach(b => {
      const r = b.region || 'Unassigned';
      if (!groups[r]) groups[r] = { sales: 0, branches: 0 };
      groups[r].sales += stats[b.id] || 0;
      groups[r].branches += 1;
    });
    return groups;
  }, [branches, stats]);

  const total = Object.values(regions).reduce((s, x) => s + x.sales, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Regions" value={String(Object.keys(regions).length)} icon={MapPin} />
        <StatCard title="Branches" value={String(branches.length)} icon={Building2} variant="primary" />
        <StatCard title="30-day sales (all)" value={fmt(total)} icon={TrendingUp} variant="success" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Regional roll-up (last 30 days)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Region</TableHead><TableHead className="text-right">Branches</TableHead><TableHead className="text-right">Sales</TableHead><TableHead>Share</TableHead></TableRow></TableHeader>
            <TableBody>
              {Object.entries(regions).sort(([,a],[,b]) => b.sales-a.sales).map(([name, r]) => {
                const pct = total ? Math.round((r.sales/total)*100) : 0;
                return (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{r.branches}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(r.sales)}</TableCell>
                    <TableCell className="w-48"><Progress value={pct} className="h-2" /><span className="text-xs text-muted-foreground">{pct}%</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
