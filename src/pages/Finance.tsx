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
import StatCard from '@/components/StatCard';
import { Wallet, TrendingUp, TrendingDown, Receipt, Plus, CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type Account = { id: string; code: string; name: string; type: string; balance: number; is_active: boolean };
type Journal = { id: string; entry_code: string; entry_date: string; description: string; total_debit: number; total_credit: number; status: string };
type PaymentReq = { id: string; request_code: string; payee: string; amount: number; currency: string; reason: string; urgency: string; status: string; created_at: string };

export default function Finance() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const canApprove = hasRole('admin') || hasRole('finance_manager');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [payments, setPayments] = useState<PaymentReq[]>([]);
  const [loading, setLoading] = useState(true);

  // dialogs
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctForm, setAcctForm] = useState({ code: '', name: '', type: 'asset' });
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ payee: '', amount: '', reason: '', urgency: 'normal', currency: 'ETB' });

  const fetchAll = async () => {
    setLoading(true);
    const [a, j, p] = await Promise.all([
      supabase.from('accounts').select('*').order('code'),
      supabase.from('journal_entries').select('*').order('entry_date', { ascending: false }).limit(20),
      supabase.from('payment_requests').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setAccounts((a.data as any) || []);
    setJournals((j.data as any) || []);
    setPayments((p.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const totals = useMemo(() => {
    const sum = (t: string) => accounts.filter(a => a.type === t).reduce((s, a) => s + Number(a.balance || 0), 0);
    return {
      assets: sum('asset'),
      liabilities: sum('liability'),
      revenue: sum('revenue'),
      expense: sum('expense'),
      pending: payments.filter(p => p.status === 'pending').length,
      pendingValue: payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0),
    };
  }, [accounts, payments]);

  const fmt = (n: number) => `ETB ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

  const addAccount = async () => {
    if (!acctForm.code || !acctForm.name) { toast({ title: 'Code and name required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('accounts').insert(acctForm as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Account created' });
    setAcctOpen(false); setAcctForm({ code: '', name: '', type: 'asset' });
    fetchAll();
  };

  const submitPayment = async () => {
    if (!payForm.payee || !payForm.amount) { toast({ title: 'Payee and amount required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const code = `PR-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from('payment_requests').insert({
      request_code: code,
      payee: payForm.payee,
      amount: Number(payForm.amount),
      currency: payForm.currency,
      reason: payForm.reason,
      urgency: payForm.urgency,
      requester_id: user?.id,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Payment request submitted' });
    setPayOpen(false); setPayForm({ payee: '', amount: '', reason: '', urgency: 'normal', currency: 'ETB' });
    fetchAll();
  };

  const setPaymentStatus = async (id: string, status: 'approved' | 'rejected') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('payment_requests')
      .update({ status, approved_by: user?.id, approved_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Payment ${status}` });
    fetchAll();
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Finance & Accounting
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Chart of accounts, journals, and payment approvals.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Assets" value={fmt(totals.assets)} icon={Building2} variant="success" />
        <StatCard label="Liabilities" value={fmt(totals.liabilities)} icon={TrendingDown} variant="warning" />
        <StatCard label="Revenue" value={fmt(totals.revenue)} icon={TrendingUp} variant="info" />
        <StatCard label="Pending Approvals" value={`${totals.pending} • ${fmt(totals.pendingValue)}`} icon={Clock} variant="default" />
      </div>

      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Payment Requests</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journals">Journal Entries</TabsTrigger>
        </TabsList>

        <TabsContent value="payments">
          <Card className="stat-card-shadow">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Payment Requests</CardTitle>
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Request</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Payment Request</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Payee</Label><Input value={payForm.payee} onChange={(e) => setPayForm({ ...payForm, payee: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Amount</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                      <div><Label>Currency</Label>
                        <Select value={payForm.currency} onValueChange={(v) => setPayForm({ ...payForm, currency: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="ETB">ETB</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Urgency</Label>
                      <Select value={payForm.urgency} onValueChange={(v) => setPayForm({ ...payForm, urgency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Reason</Label><Textarea value={payForm.reason} onChange={(e) => setPayForm({ ...payForm, reason: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={submitPayment}>Submit</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Payee</TableHead><TableHead>Amount</TableHead>
                    <TableHead>Urgency</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead>
                    {canApprove && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 && (
                    <TableRow><TableCell colSpan={canApprove ? 7 : 6} className="text-center text-muted-foreground py-8">No payment requests yet.</TableCell></TableRow>
                  )}
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.request_code}</TableCell>
                      <TableCell className="font-medium">{p.payee}</TableCell>
                      <TableCell>{p.currency} {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="secondary" className={urgencyColor[p.urgency]}>{p.urgency}</Badge></TableCell>
                      <TableCell><Badge variant="secondary" className={statusColor[p.status]}>{p.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      {canApprove && (
                        <TableCell>
                          {p.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setPaymentStatus(p.id, 'approved')} className="h-7 px-2 text-success"><CheckCircle2 className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setPaymentStatus(p.id, 'rejected')} className="h-7 px-2 text-destructive"><XCircle className="w-4 h-4" /></Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card className="stat-card-shadow">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Chart of Accounts</CardTitle>
              {canApprove && (
                <Dialog open={acctOpen} onOpenChange={setAcctOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Account</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Code</Label><Input value={acctForm.code} onChange={(e) => setAcctForm({ ...acctForm, code: e.target.value })} placeholder="1000" /></div>
                      <div><Label>Name</Label><Input value={acctForm.name} onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })} placeholder="Cash on Hand" /></div>
                      <div><Label>Type</Label>
                        <Select value={acctForm.type} onValueChange={(v) => setAcctForm({ ...acctForm, type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asset">Asset</SelectItem><SelectItem value="liability">Liability</SelectItem>
                            <SelectItem value="equity">Equity</SelectItem><SelectItem value="revenue">Revenue</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter><Button onClick={addAccount}>Create</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {accounts.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No accounts yet. Add one to get started.</TableCell></TableRow>}
                  {accounts.map(a => (
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
        </TabsContent>

        <TabsContent value="journals">
          <Card className="stat-card-shadow">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="w-4 h-4" /> Recent Journal Entries</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {journals.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No journal entries yet.</TableCell></TableRow>}
                  {journals.map(j => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs">{j.entry_code}</TableCell>
                      <TableCell>{j.entry_date}</TableCell>
                      <TableCell>{j.description}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(j.total_debit))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(j.total_credit))}</TableCell>
                      <TableCell><Badge variant="secondary">{j.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
