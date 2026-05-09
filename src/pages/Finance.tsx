import { useEffect, useMemo, useState, useRef } from 'react';
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
import { Switch } from '@/components/ui/switch';
import StatCard from '@/components/StatCard';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, Plus, CheckCircle2, XCircle, Clock, Building2,
  Landmark, Upload, FileSpreadsheet, ShieldCheck, Settings as SettingsIcon, Layers, Banknote, ArrowUpRight, ArrowDownRight,
  RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import BankCsvImportDialog from '@/components/finance/BankCsvImportDialog';
import ComplianceTab from '@/components/finance/ComplianceTab';

const fmt = (n: number, cur = 'ETB') =>
  `${cur} ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function Finance() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canApprove = hasRole('admin') || hasRole('finance_manager');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Finance & Accounting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cash flow, approvals, reconciliation, VAT/WHT, budgets, and branch profitability — synced from POS, payroll, and procurement in real time.
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="payments">Approvals</TabsTrigger>
          <TabsTrigger value="bank">Bank & Recon</TabsTrigger>
          <TabsTrigger value="branches">Branch P&L</TabsTrigger>
          <TabsTrigger value="tax">VAT / WHT</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="journals">Journals</TabsTrigger>
          {canApprove && <TabsTrigger value="settings"><SettingsIcon className="w-3.5 h-3.5 mr-1" />Rules</TabsTrigger>}
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab canApprove={canApprove} /></TabsContent>
        <TabsContent value="bank"><BankTab canApprove={canApprove} /></TabsContent>
        <TabsContent value="branches"><BranchPnlTab /></TabsContent>
        <TabsContent value="tax"><TaxTab /></TabsContent>
        <TabsContent value="budgets"><BudgetsTab canApprove={canApprove} /></TabsContent>
        <TabsContent value="accounts"><AccountsTab canApprove={canApprove} /></TabsContent>
        <TabsContent value="journals"><JournalsTab /></TabsContent>
        {canApprove && <TabsContent value="settings"><RulesTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

/* ──────────────────────────── Dashboard ──────────────────────────── */

function DashboardTab() {
  const [data, setData] = useState({
    cash: 0, bank: 0, ar: 0, ap: 0, vatPayable: 0, payeDue: 0, pensionDue: 0,
    todaySales: 0, todayCount: 0, pending: 0, pendingValue: 0, overdueAR: 0, expense30: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const since30 = new Date(); since30.setDate(since30.getDate() - 30);

    const [accs, sales, payReq, credits, pl] = await Promise.all([
      supabase.from('accounts').select('code, balance, type'),
      supabase.from('sales').select('total, created_at').gte('created_at', today.toISOString()),
      supabase.from('payment_requests').select('amount, status').eq('status', 'pending'),
      supabase.from('credit_sales').select('total_amount, paid_amount, due_date, status').neq('status', 'closed'),
      supabase.from('payslips').select('net_pay, status').eq('status', 'draft'),
    ]);

    const accMap: Record<string, number> = {};
    (accs.data || []).forEach((a: any) => { accMap[a.code] = Number(a.balance || 0); });

    const cash = accMap['1000'] || 0;
    const bank = (accMap['1010'] || 0) + (accMap['1020'] || 0) + (accMap['1030'] || 0);
    const ar = accMap['1100'] || 0;
    const ap = accMap['2000'] || 0;
    const vatPayable = accMap['2100'] || 0;
    const payeDue = accMap['2200'] || 0;
    const pensionDue = accMap['2300'] || 0;

    const todaySales = (sales.data || []).reduce((s, r: any) => s + Number(r.total || 0), 0);
    const pendingValue = (payReq.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

    const now = Date.now();
    const overdueAR = (credits.data || [])
      .filter((c: any) => c.due_date && new Date(c.due_date).getTime() < now)
      .reduce((s, c: any) => s + (Number(c.total_amount || 0) - Number(c.paid_amount || 0)), 0);

    const payrollDue = (pl.data || []).reduce((s, r: any) => s + Number(r.net_pay || 0), 0);

    setData({
      cash, bank, ar, ap, vatPayable, payeDue, pensionDue: pensionDue + payrollDue,
      todaySales, todayCount: sales.data?.length || 0,
      pending: payReq.data?.length || 0, pendingValue, overdueAR, expense30: 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('finance-dash')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Cash on Hand" value={fmt(data.cash)} icon={Banknote} variant="success" />
        <StatCard title="Bank + Mobile Money" value={fmt(data.bank)} icon={Landmark} variant="primary" />
        <StatCard title="Accounts Receivable" value={fmt(data.ar)} icon={ArrowDownRight} variant="warning" />
        <StatCard title="Accounts Payable" value={fmt(data.ap)} icon={ArrowUpRight} variant="default" />
        <StatCard title="Today's Sales" value={`${fmt(data.todaySales)} • ${data.todayCount} txn`} icon={TrendingUp} variant="success" />
        <StatCard title="VAT Payable (15%)" value={fmt(data.vatPayable)} icon={Receipt} variant="warning" />
        <StatCard title="PAYE / Pension Due" value={fmt(data.payeDue + data.pensionDue)} icon={ShieldCheck} variant="default" />
        <StatCard title="Overdue Receivables" value={fmt(data.overdueAR)} icon={AlertTriangle} variant="warning" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Pending approvals</CardTitle>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="secondary" className="text-sm py-1.5 px-3">
              {data.pending} requests waiting
            </Badge>
            <span className="text-2xl font-bold text-warning">{fmt(data.pendingValue)}</span>
            <span className="text-xs text-muted-foreground">total value pending finance approval</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cash flow forecast (next 30 days)</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1.5">
          <div className="flex justify-between border-b pb-2">
            <span>Expected receivables (AR)</span><span className="font-mono text-success">+ {fmt(data.ar)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>Expected payables (AP)</span><span className="font-mono text-destructive">− {fmt(data.ap)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>Pending payment requests</span><span className="font-mono text-destructive">− {fmt(data.pendingValue)}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span>Tax obligations (VAT + PAYE + Pension)</span>
            <span className="font-mono text-destructive">− {fmt(data.vatPayable + data.payeDue + data.pensionDue)}</span>
          </div>
          <div className="flex justify-between pt-2 font-semibold text-foreground">
            <span>Projected net cash position</span>
            <span className="font-mono">
              {fmt(data.cash + data.bank + data.ar - data.ap - data.pendingValue - data.vatPayable - data.payeDue - data.pensionDue)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ──────────────────────────── Payments / Approvals ──────────────────────────── */

function PaymentsTab({ canApprove }: { canApprove: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ payee: '', amount: '', reason: '', urgency: 'normal', currency: 'ETB' });
  const [approvals, setApprovals] = useState<Record<string, any[]>>({});

  const load = async () => {
    const { data } = await supabase
      .from('payment_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setItems((data as any) || []);
    if (data && data.length) {
      const ids = data.map((d: any) => d.id);
      const { data: aps } = await supabase
        .from('payment_approvals' as any)
        .select('*')
        .in('payment_request_id', ids);
      const map: Record<string, any[]> = {};
      (aps || []).forEach((a: any) => { (map[a.payment_request_id] = map[a.payment_request_id] || []).push(a); });
      setApprovals(map);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.payee || !form.amount) { toast({ title: 'Payee and amount required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const code = `PR-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from('payment_requests').insert({
      request_code: code,
      payee: form.payee,
      amount: Number(form.amount),
      currency: form.currency,
      reason: form.reason,
      urgency: form.urgency,
      requester_id: user?.id,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Submitted for approval' });
    setOpen(false); setForm({ payee: '', amount: '', reason: '', urgency: 'normal', currency: 'ETB' });
    load();
  };

  const decide = async (req: any, decision: 'approved' | 'rejected', comment = '') => {
    const { data: { user } } = await supabase.auth.getUser();
    const step = (approvals[req.id]?.length || 0) + 1;
    await supabase.from('payment_approvals' as any).insert({
      payment_request_id: req.id,
      step_order: step,
      approver_id: user?.id,
      decision,
      comment,
      decided_at: new Date().toISOString(),
    } as any);

    // Determine if more approval levels remain
    const { data: rules } = await supabase
      .from('payment_approval_rules' as any)
      .select('*')
      .eq('is_active', true)
      .lte('min_amount', Number(req.amount))
      .order('step_order');
    const applicable = (rules || []).filter((r: any) => !r.max_amount || Number(r.max_amount) >= Number(req.amount));

    let newStatus = req.status;
    if (decision === 'rejected') newStatus = 'rejected';
    else if (applicable.length === 0 || step >= applicable.length) newStatus = 'approved';
    else newStatus = 'pending';

    await supabase
      .from('payment_requests')
      .update({
        status: newStatus,
        approved_by: newStatus === 'approved' ? user?.id : null,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
      } as any)
      .eq('id', req.id);

    toast({ title: `Step ${step} ${decision}` });
    load();
  };

  const urgencyColor: Record<string, string> = {
    low: 'bg-muted text-muted-foreground',
    normal: 'bg-info/15 text-info',
    high: 'bg-warning/20 text-warning-foreground',
    urgent: 'bg-destructive/15 text-destructive',
  };
  const statusColor: Record<string, string> = {
    pending: 'bg-warning/15 text-warning-foreground',
    approved: 'bg-success/15 text-success',
    rejected: 'bg-destructive/15 text-destructive',
    paid: 'bg-primary/15 text-primary',
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Payment Requests · Multi-level approval</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Payment Request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Payee</Label><Input value={form.payee} onChange={(e) => setForm({ ...form, payee: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ETB">ETB</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead><TableHead>Payee</TableHead><TableHead>Amount</TableHead>
              <TableHead>Urgency</TableHead><TableHead>Steps</TableHead><TableHead>Status</TableHead>
              {canApprove && <TableHead>Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={canApprove ? 7 : 6} className="text-center text-muted-foreground py-8">No payment requests yet.</TableCell></TableRow>
            )}
            {items.map((p) => {
              const aps = approvals[p.id] || [];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.request_code}</TableCell>
                  <TableCell className="font-medium">{p.payee}</TableCell>
                  <TableCell>{p.currency} {Number(p.amount).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={urgencyColor[p.urgency]}>{p.urgency}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {aps.length === 0 ? <span className="text-muted-foreground">—</span> :
                      aps.map((a) => (
                        <span key={a.id} className={`inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] ${a.decision === 'approved' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                          #{a.step_order} {a.decision}
                        </span>
                      ))}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className={statusColor[p.status]}>{p.status}</Badge></TableCell>
                  {canApprove && (
                    <TableCell>
                      {p.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => decide(p, 'approved')} className="h-7 px-2 text-success"><CheckCircle2 className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => decide(p, 'rejected')} className="h-7 px-2 text-destructive"><XCircle className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── Bank & Reconciliation ──────────────────────────── */

function BankTab({ canApprove }: { canApprove: boolean }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctForm, setAcctForm] = useState({ name: '', bank_name: '', account_number: '', account_type: 'bank', currency: 'ETB', gl_account_code: '1030' });
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from('bank_accounts' as any).select('*').order('created_at');
    setAccounts((data as any) || []);
    if (data && data.length && !selected) setSelected((data[0] as any).id);
  };
  const loadLines = async (id: string) => {
    if (!id) return;
    const { data } = await supabase.from('bank_statement_lines' as any).select('*').eq('bank_account_id', id).order('txn_date', { ascending: false }).limit(100);
    setLines((data as any) || []);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (selected) loadLines(selected); }, [selected]);

  const addAccount = async () => {
    if (!acctForm.name) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('bank_accounts' as any).insert(acctForm as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Bank account added' });
    setAcctOpen(false);
    setAcctForm({ name: '', bank_name: '', account_number: '', account_type: 'bank', currency: 'ETB', gl_account_code: '1030' });
    load();
  };

  const importCsv = async (file: File) => {
    if (!selected) { toast({ title: 'Select an account first', variant: 'destructive' }); return; }
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) { toast({ title: 'Empty CSV', variant: 'destructive' }); return; }
    const header = rows[0].toLowerCase().split(',').map((s) => s.trim());
    const idxDate = header.findIndex((h) => h.includes('date'));
    const idxDesc = header.findIndex((h) => h.includes('desc') || h.includes('narr'));
    const idxRef = header.findIndex((h) => h.includes('ref'));
    const idxDebit = header.findIndex((h) => h.includes('debit') || h === 'out');
    const idxCredit = header.findIndex((h) => h.includes('credit') || h === 'in');
    const idxBal = header.findIndex((h) => h.includes('balance'));
    if (idxDate < 0 || (idxDebit < 0 && idxCredit < 0)) {
      toast({ title: 'CSV needs Date + Debit/Credit columns', variant: 'destructive' });
      return;
    }
    const records: any[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      const date = cols[idxDate];
      if (!date) continue;
      records.push({
        bank_account_id: selected,
        txn_date: date,
        description: idxDesc >= 0 ? cols[idxDesc] || '' : '',
        reference: idxRef >= 0 ? cols[idxRef] || '' : '',
        debit: idxDebit >= 0 ? Number(cols[idxDebit] || 0) || 0 : 0,
        credit: idxCredit >= 0 ? Number(cols[idxCredit] || 0) || 0 : 0,
        balance: idxBal >= 0 ? Number(cols[idxBal] || 0) || null : null,
      });
    }
    const { error } = await supabase.from('bank_statement_lines' as any).insert(records as any);
    if (error) { toast({ title: 'Import failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Imported ${records.length} lines` });
    loadLines(selected);
    if (fileRef.current) fileRef.current.value = '';
  };

  const toggleReconcile = async (line: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('bank_statement_lines' as any)
      .update({
        reconciled: !line.reconciled,
        reconciled_by: !line.reconciled ? user?.id : null,
        reconciled_at: !line.reconciled ? new Date().toISOString() : null,
      } as any)
      .eq('id', line.id);
    loadLines(selected);
  };

  const reconciledPct = lines.length === 0 ? 0 : Math.round((lines.filter((l) => l.reconciled).length / lines.length) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base">Bank, Telebirr & CBE Birr accounts</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Manage cash & mobile money accounts. Import statements via CSV for reconciliation.</p>
          </div>
          {canApprove && (
            <Dialog open={acctOpen} onOpenChange={setAcctOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add account</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New bank account</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Display name</Label><Input value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} placeholder="CBE Main" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Bank</Label><Input value={acctForm.bank_name} onChange={(e) => setAcctForm({ ...acctForm, bank_name: e.target.value })} /></div>
                    <div><Label>Account #</Label><Input value={acctForm.account_number} onChange={(e) => setAcctForm({ ...acctForm, account_number: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Type</Label>
                      <Select value={acctForm.account_type} onValueChange={(v) => setAcctForm({ ...acctForm, account_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank</SelectItem>
                          <SelectItem value="telebirr">Telebirr</SelectItem>
                          <SelectItem value="cbe_birr">CBE Birr</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Currency</Label><Input value={acctForm.currency} onChange={(e) => setAcctForm({ ...acctForm, currency: e.target.value })} /></div>
                    <div><Label>GL code</Label><Input value={acctForm.gl_account_code} onChange={(e) => setAcctForm({ ...acctForm, gl_account_code: e.target.value })} /></div>
                  </div>
                </div>
                <DialogFooter><Button onClick={addAccount}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts yet — add one to start reconciling.</p>}
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`text-left rounded-md border p-3 hover:bg-muted/50 transition ${selected === a.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Landmark className="w-4 h-4" /> {a.name}
                </div>
                <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{a.account_type} · {a.bank_name || '—'}</div>
                <div className="text-base font-mono mt-1">{fmt(Number(a.current_balance || 0), a.currency)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" /> Statement lines
                <Badge variant="secondary" className="ml-2 text-[10px]">{reconciledPct}% reconciled</Badge>
              </CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1">CSV columns: Date, Description, Reference, Debit, Credit, Balance</p>
            </div>
            {canApprove && (
              <div>
                <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3.5 h-3.5 mr-1" /> Import CSV
                </Button>
                <BankCsvImportDialog
                  open={importOpen}
                  onOpenChange={setImportOpen}
                  bankAccountId={selected}
                  onImported={() => loadLines(selected)}
                />
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Ref</TableHead>
                  <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No statement lines yet.</TableCell></TableRow>}
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{l.txn_date}</TableCell>
                    <TableCell className="text-xs">{l.description}</TableCell>
                    <TableCell className="font-mono text-[11px]">{l.reference}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{l.debit > 0 ? Number(l.debit).toLocaleString() : ''}</TableCell>
                    <TableCell className="text-right font-mono text-success">{l.credit > 0 ? Number(l.credit).toLocaleString() : ''}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => canApprove && toggleReconcile(l)}
                        disabled={!canApprove}
                        className={`text-[11px] px-2 py-0.5 rounded ${l.reconciled ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning-foreground'} ${canApprove ? 'cursor-pointer hover:opacity-80' : ''}`}
                      >
                        {l.reconciled ? '✓ Matched' : 'Unmatched'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ──────────────────────────── Branch P&L ──────────────────────────── */

function BranchPnlTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const [branches, sales] = await Promise.all([
        supabase.from('branches').select('id, name, code'),
        supabase.from('sales').select('branch_id, total, subtotal, vat, created_at').gte('created_at', since.toISOString()),
      ]);
      const byBranch: Record<string, { revenue: number; vat: number; count: number }> = {};
      (sales.data || []).forEach((s: any) => {
        const k = s.branch_id || 'unassigned';
        byBranch[k] = byBranch[k] || { revenue: 0, vat: 0, count: 0 };
        byBranch[k].revenue += Number(s.subtotal || 0);
        byBranch[k].vat += Number(s.vat || 0);
        byBranch[k].count += 1;
      });
      const out = (branches.data || []).map((b: any) => ({
        ...b,
        ...(byBranch[b.id] || { revenue: 0, vat: 0, count: 0 }),
      }));
      setRows(out);
    })();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Branch profitability — last 30 days</CardTitle>
        <p className="text-xs text-muted-foreground">Net revenue (excl. VAT), VAT collected, transactions per branch.</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead><TableHead>Code</TableHead>
              <TableHead className="text-right">Revenue (net)</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No branch data.</TableCell></TableRow>}
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="font-mono text-xs">{b.code}</TableCell>
                <TableCell className="text-right font-mono">{fmt(b.revenue)}</TableCell>
                <TableCell className="text-right font-mono text-warning">{fmt(b.vat)}</TableCell>
                <TableCell className="text-right">{b.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── VAT / Withholding ──────────────────────────── */

function TaxTab() {
  const { toast } = useToast();
  const [s, setS] = useState<any>({ vat_rate: 0.15, withholding_rate: 0.02, withholding_threshold: 3000, fiscal_year_start_month: 7, base_currency: 'ETB' });
  const [vatPayable, setVatPayable] = useState(0);
  const [payeDue, setPayeDue] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('finance_settings' as any).select('*').limit(1).maybeSingle();
      if (data) setS(data);
      const { data: accs } = await supabase.from('accounts').select('code, balance').in('code', ['2100', '2200']);
      (accs || []).forEach((a: any) => {
        if (a.code === '2100') setVatPayable(Number(a.balance || 0));
        if (a.code === '2200') setPayeDue(Number(a.balance || 0));
      });
    })();
  }, []);

  const save = async () => {
    const payload = {
      vat_rate: Number(s.vat_rate),
      withholding_rate: Number(s.withholding_rate),
      withholding_threshold: Number(s.withholding_threshold),
      fiscal_year_start_month: Number(s.fiscal_year_start_month),
      base_currency: s.base_currency,
    };
    const { data: existing } = await supabase.from('finance_settings' as any).select('id').limit(1).maybeSingle();
    const op = existing
      ? supabase.from('finance_settings' as any).update(payload).eq('id', (existing as any).id)
      : supabase.from('finance_settings' as any).insert(payload as any);
    const { error } = await op;
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Tax settings saved' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Ethiopia tax settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>VAT rate (decimal)</Label><Input type="number" step="0.01" value={s.vat_rate} onChange={(e) => setS({ ...s, vat_rate: e.target.value })} /></div>
            <div><Label>Withholding rate</Label><Input type="number" step="0.01" value={s.withholding_rate} onChange={(e) => setS({ ...s, withholding_rate: e.target.value })} /></div>
            <div><Label>WHT threshold (ETB)</Label><Input type="number" value={s.withholding_threshold} onChange={(e) => setS({ ...s, withholding_threshold: e.target.value })} /></div>
            <div><Label>Fiscal year starts (month)</Label><Input type="number" min={1} max={12} value={s.fiscal_year_start_month} onChange={(e) => setS({ ...s, fiscal_year_start_month: e.target.value })} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Ethiopian default: 15% VAT, 2% withholding on supplier payments above ETB 3,000, fiscal year starts July (Hamle).
          </p>
          <Button size="sm" onClick={save}>Save settings</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Current tax liabilities</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">VAT payable (account 2100)</div>
            <div className="text-2xl font-bold text-warning mt-1">{fmt(vatPayable)}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">PAYE withheld (account 2200)</div>
            <div className="text-2xl font-bold text-warning mt-1">{fmt(payeDue)}</div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Both accounts are auto-updated by POS sales and approved payroll runs via the GL posting trigger.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ──────────────────────────── Budgets ──────────────────────────── */

function BudgetsTab({ canApprove }: { canApprove: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ account_code: '', fiscal_year: new Date().getFullYear(), monthly: '0' });

  const load = async () => {
    const { data } = await supabase.from('budgets' as any).select('*').order('fiscal_year', { ascending: false });
    setItems((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.account_code) { toast({ title: 'Account code required', variant: 'destructive' }); return; }
    const monthly = Array(12).fill(Number(form.monthly) || 0);
    const { error } = await supabase.from('budgets' as any).insert({
      account_code: form.account_code,
      fiscal_year: Number(form.fiscal_year),
      monthly_amounts: monthly,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Budget added' });
    setOpen(false);
    setForm({ account_code: '', fiscal_year: new Date().getFullYear(), monthly: '0' });
    load();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Budgets vs Actual</CardTitle>
        {canApprove && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New budget</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New budget line</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Account code</Label><Input value={form.account_code} onChange={(e) => setForm({ ...form, account_code: e.target.value })} placeholder="5000" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Fiscal year</Label><Input type="number" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })} /></div>
                  <div><Label>Monthly amount (ETB)</Label><Input type="number" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead><TableHead>Year</TableHead>
              <TableHead className="text-right">Monthly</TableHead><TableHead className="text-right">Annual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No budgets yet.</TableCell></TableRow>}
            {items.map((b) => {
              const monthly = Array.isArray(b.monthly_amounts) ? b.monthly_amounts[0] || 0 : 0;
              const annual = (b.monthly_amounts || []).reduce((s: number, x: number) => s + Number(x), 0);
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-mono">{b.account_code || '—'}</TableCell>
                  <TableCell>{b.fiscal_year}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(monthly)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(annual)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── Approval rules ──────────────────────────── */

function RulesTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ branch_id: '', step_order: 1, min_amount: 0, max_amount: '', required_role: 'finance_manager' });

  const load = async () => {
    const [r, b] = await Promise.all([
      supabase.from('payment_approval_rules' as any).select('*').order('branch_id').order('step_order'),
      supabase.from('branches').select('id, name').eq('is_active', true),
    ]);
    setRules((r.data as any) || []);
    setBranches((b.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload: any = {
      branch_id: form.branch_id || null,
      step_order: Number(form.step_order),
      min_amount: Number(form.min_amount),
      max_amount: form.max_amount ? Number(form.max_amount) : null,
      required_role: form.required_role,
    };
    const { error } = await supabase.from('payment_approval_rules' as any).insert(payload);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Rule added' });
    setOpen(false);
    setForm({ branch_id: '', step_order: 1, min_amount: 0, max_amount: '', required_role: 'finance_manager' });
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('payment_approval_rules' as any).delete().eq('id', id);
    load();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Approval rules per branch</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Define amount thresholds and which role must approve at each step.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New rule</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New approval rule</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Branch (optional — blank = all)</Label>
                <Select value={form.branch_id || 'all'} onValueChange={(v) => setForm({ ...form, branch_id: v === 'all' ? '' : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Step #</Label><Input type="number" min={1} value={form.step_order} onChange={(e) => setForm({ ...form, step_order: Number(e.target.value) })} /></div>
                <div><Label>Min amount</Label><Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: Number(e.target.value) })} /></div>
                <div><Label>Max amount</Label><Input type="number" value={form.max_amount} onChange={(e) => setForm({ ...form, max_amount: e.target.value })} placeholder="∞" /></div>
              </div>
              <div><Label>Required role</Label>
                <Select value={form.required_role} onValueChange={(v) => setForm({ ...form, required_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="branch_manager">Branch Manager</SelectItem>
                    <SelectItem value="finance_manager">Finance Manager</SelectItem>
                    <SelectItem value="admin">Admin / CFO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead><TableHead>Step</TableHead>
              <TableHead className="text-right">Min</TableHead><TableHead className="text-right">Max</TableHead>
              <TableHead>Role</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No rules — payments require a single finance approval by default.</TableCell></TableRow>}
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{branches.find((b) => b.id === r.branch_id)?.name || <span className="text-muted-foreground">All</span>}</TableCell>
                <TableCell>#{r.step_order}</TableCell>
                <TableCell className="text-right font-mono">{fmt(Number(r.min_amount))}</TableCell>
                <TableCell className="text-right font-mono">{r.max_amount ? fmt(Number(r.max_amount)) : '∞'}</TableCell>
                <TableCell><Badge variant="secondary">{r.required_role}</Badge></TableCell>
                <TableCell><Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => remove(r.id)}><XCircle className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────── Accounts & Journals ──────────────────────────── */

function AccountsTab({ canApprove }: { canApprove: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'asset' });
  const load = async () => {
    const { data } = await supabase.from('accounts').select('*').order('code');
    setItems((data as any) || []);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!form.code || !form.name) { toast({ title: 'Code + name required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('accounts').insert(form as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Account created' });
    setOpen(false); setForm({ code: '', name: '', type: 'asset' });
    load();
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Chart of Accounts</CardTitle>
        {canApprove && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asset">Asset</SelectItem><SelectItem value="liability">Liability</SelectItem>
                      <SelectItem value="equity">Equity</SelectItem><SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={add}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No accounts.</TableCell></TableRow>}
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{a.type}</TableCell>
                <TableCell className="text-right font-mono">{fmt(Number(a.balance))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function JournalsTab() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(50);
      setItems((data as any) || []);
    })();
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Recent journals (auto-posted from POS, payroll, GRN, payments)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No entries yet.</TableCell></TableRow>}
            {items.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="font-mono text-xs">{j.entry_code}</TableCell>
                <TableCell>{j.entry_date}</TableCell>
                <TableCell className="text-sm">{j.description}</TableCell>
                <TableCell className="text-right font-mono">{fmt(Number(j.total_debit))}</TableCell>
                <TableCell className="text-right font-mono">{fmt(Number(j.total_credit))}</TableCell>
                <TableCell><Badge variant="secondary">{j.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
