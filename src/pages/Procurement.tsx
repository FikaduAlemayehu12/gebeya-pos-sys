import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import StatCard from '@/components/StatCard';
import { Truck, Package, Award, Plus, Star, FileText, Send, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink, Bookmark, ClipboardList, Sparkles, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Supplier = { id: string; name: string; code: string; category: string; phone: string; email: string; rating: number; total_orders: number; total_spend: number; is_active: boolean; license_expiry: string | null; tin?: string; vat_number?: string; payment_terms?: string; lead_time_days?: number; performance_score?: number; on_time_delivery_rate?: number; quality_score?: number };
type PO = { id: string; po_number: string; supplier_id: string; order_date: string; expected_delivery: string | null; status: string; total: number; currency: string };
type PR = { id: string; pr_number: string; branch_id: string | null; department: string; required_date: string | null; urgency: string; estimated_total: number; currency: string; status: string; created_at: string; preferred_supplier_id?: string | null; notes?: string };
type RFQ = { id: string; rfq_number: string; title: string; closing_date: string | null; status: string; created_at: string };
type Quote = { id: string; rfq_id: string; supplier_id: string; total_price: number; delivery_days: number; payment_terms: string; warranty: string; score: number; is_winner: boolean };
type Invoice = { id: string; invoice_number: string; supplier_id: string; po_id: string | null; grn_id: string | null; invoice_date: string; total: number; subtotal: number; vat: number; match_status: string; status: string; match_notes: string };
type Contract = { id: string; contract_number: string; supplier_id: string; title: string; start_date: string; end_date: string; contract_value: number; used_value: number; status: string };
type Tender = { id: string; title: string; source: string; url: string; deadline: string | null; status: string; notes: string };

const fmt = (n: number, cur = 'ETB') => `${cur} ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function Procurement() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Truck className="w-6 h-6 text-primary" /> Procurement</h1>
        <p className="text-sm text-muted-foreground mt-1">Suppliers, requests, RFQs, purchase orders, 3-way matching, contracts and tenders.</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="prs">Requests</TabsTrigger>
          <TabsTrigger value="rfqs">RFQs</TabsTrigger>
          <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
          <TabsTrigger value="invoices">Invoices &amp; 3-Way Match</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="tenders">Tenders</TabsTrigger>
          <TabsTrigger value="ai">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><DashboardTab /></TabsContent>
        <TabsContent value="prs"><PRsTab /></TabsContent>
        <TabsContent value="rfqs"><RFQsTab /></TabsContent>
        <TabsContent value="pos"><POsTab /></TabsContent>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
        <TabsContent value="contracts"><ContractsTab /></TabsContent>
        <TabsContent value="tenders"><TendersTab /></TabsContent>
        <TabsContent value="ai"><AiAssistantTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ───────── Dashboard ───────── */
function DashboardTab() {
  const [data, setData] = useState({ openPRs: 0, openRFQs: 0, activePOs: 0, pendingApproval: 0, overdueDelivery: 0, totalSpend: 0, expiringContracts: 0, expiringDocs: 0 });
  useEffect(() => { (async () => {
    const today = new Date().toISOString().slice(0,10);
    const in30 = new Date(); in30.setDate(in30.getDate()+30);
    const in30s = in30.toISOString().slice(0,10);
    const [prs, rfqs, pos, sups, contracts, docs] = await Promise.all([
      supabase.from('purchase_requests' as any).select('id,status', { count: 'exact' }),
      supabase.from('rfqs' as any).select('id,status', { count: 'exact' }),
      supabase.from('purchase_orders').select('id,status,total,expected_delivery'),
      supabase.from('suppliers').select('total_spend'),
      supabase.from('supplier_contracts' as any).select('id,end_date,status'),
      supabase.from('supplier_documents' as any).select('id,expiry_date'),
    ]);
    const posRows = (pos.data as any[]) || [];
    setData({
      openPRs: ((prs.data as any[])||[]).filter(r => ['draft','pending_approval'].includes(r.status)).length,
      openRFQs: ((rfqs.data as any[])||[]).filter(r => r.status === 'open').length,
      activePOs: posRows.filter(p => ['approved','sent','partial'].includes(p.status)).length,
      pendingApproval: posRows.filter(p => p.status === 'pending_approval').length,
      overdueDelivery: posRows.filter(p => p.expected_delivery && p.expected_delivery < today && !['delivered','closed','cancelled'].includes(p.status)).length,
      totalSpend: ((sups.data as any[])||[]).reduce((s, r) => s + Number(r.total_spend||0), 0),
      expiringContracts: ((contracts.data as any[])||[]).filter(c => c.status==='active' && c.end_date <= in30s).length,
      expiringDocs: ((docs.data as any[])||[]).filter(d => d.expiry_date && d.expiry_date <= in30s).length,
    });
  })(); }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Open Requests" value={String(data.openPRs)} icon={ClipboardList} variant="primary" />
        <StatCard title="Open RFQs" value={String(data.openRFQs)} icon={Send} variant="default" />
        <StatCard title="Active POs" value={String(data.activePOs)} icon={Package} variant="primary" />
        <StatCard title="Pending Approval" value={String(data.pendingApproval)} icon={ShieldCheck} variant="warning" />
        <StatCard title="Overdue Deliveries" value={String(data.overdueDelivery)} icon={AlertTriangle} variant="warning" />
        <StatCard title="Total Spend" value={fmt(data.totalSpend)} icon={Star} />
        <StatCard title="Contracts Expiring (30d)" value={String(data.expiringContracts)} icon={FileText} variant="warning" />
        <StatCard title="Docs Expiring (30d)" value={String(data.expiringDocs)} icon={ShieldCheck} variant="warning" />
      </div>
    </div>
  );
}

/* ───────── Purchase Requests ───────── */
function PRsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PR[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ pr_number: '', department: '', required_date: '', urgency: 'normal', estimated_total: '', notes: '', preferred_supplier_id: '' });

  const load = async () => {
    const [r, s] = await Promise.all([
      supabase.from('purchase_requests' as any).select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('suppliers').select('*').eq('is_active', true).order('name'),
    ]);
    setRows((r.data as any) || []);
    setSuppliers((s.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.pr_number || !form.estimated_total) { toast({ title: 'PR # and amount required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('purchase_requests' as any).insert({
      pr_number: form.pr_number, department: form.department, required_date: form.required_date || null, urgency: form.urgency,
      estimated_total: Number(form.estimated_total), notes: form.notes,
      preferred_supplier_id: form.preferred_supplier_id || null,
      requester_id: user?.id, status: 'pending_approval',
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Purchase request submitted' });
    setOpen(false); setForm({ pr_number: '', department: '', required_date: '', urgency: 'normal', estimated_total: '', notes: '', preferred_supplier_id: '' });
    load();
  };

  const decide = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('purchase_requests' as any).update({ status, approved_by: user?.id, approved_at: new Date().toISOString() } as any).eq('id', id);
    toast({ title: `PR ${status}` }); load();
  };

  const statusColor: Record<string,string> = {
    draft:'bg-muted text-muted-foreground', pending_approval:'bg-warning/15 text-warning-foreground',
    approved:'bg-success/15 text-success', rejected:'bg-destructive/15 text-destructive', converted:'bg-primary/15 text-primary',
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Purchase Requests</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Purchase Request</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>PR Number</Label><Input value={form.pr_number} onChange={(e) => setForm({ ...form, pr_number: e.target.value })} placeholder="PR-2026-001" /></div>
                <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Required by</Label><Input type="date" value={form.required_date} onChange={(e) => setForm({ ...form, required_date: e.target.value })} /></div>
                <div><Label>Urgency</Label>
                  <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Estimated total (ETB)</Label><Input type="number" value={form.estimated_total} onChange={(e) => setForm({ ...form, estimated_total: e.target.value })} /></div>
              </div>
              <div><Label>Preferred supplier</Label>
                <Select value={form.preferred_supplier_id || '__none__'} onValueChange={(v) => setForm({ ...form, preferred_supplier_id: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">None</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Justification</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Submit</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>PR #</TableHead><TableHead>Dept</TableHead><TableHead>Need by</TableHead><TableHead>Urgency</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase requests yet.</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.pr_number}</TableCell>
                <TableCell>{r.department || '—'}</TableCell>
                <TableCell className="text-xs">{r.required_date || '—'}</TableCell>
                <TableCell><Badge variant="secondary" className="capitalize">{r.urgency}</Badge></TableCell>
                <TableCell className="text-right font-mono">{fmt(Number(r.estimated_total), r.currency)}</TableCell>
                <TableCell><Badge variant="secondary" className={statusColor[r.status]}>{r.status.replace('_',' ')}</Badge></TableCell>
                <TableCell className="flex gap-1">
                  {r.status === 'pending_approval' && <>
                    <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => decide(r.id, 'approved')}>Approve</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => decide(r.id, 'rejected')}>Reject</Button>
                  </>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───────── RFQs ───────── */
function RFQsTab() {
  const { toast } = useToast();
  const [rfqs, setRfqs] = useState<RFQ[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [form, setForm] = useState({ rfq_number: '', title: '', description: '', closing_date: '' });
  const [qf, setQf] = useState({ supplier_id: '', total_price: '', delivery_days: '', payment_terms: '', warranty: '' });

  const load = async () => {
    const [r, q, s] = await Promise.all([
      supabase.from('rfqs' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('quotations' as any).select('*'),
      supabase.from('suppliers').select('*').eq('is_active', true),
    ]);
    setRfqs((r.data as any) || []); setQuotes((q.data as any) || []); setSuppliers((s.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.rfq_number || !form.title) { toast({ title: 'RFQ # and title required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('rfqs' as any).insert({ ...form, closing_date: form.closing_date || null, created_by: user?.id } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'RFQ created' }); setOpen(false); setForm({ rfq_number:'', title:'', description:'', closing_date:'' }); load();
  };

  const addQuote = async () => {
    if (!selectedRfq || !qf.supplier_id || !qf.total_price) { toast({ title: 'Supplier and price required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('quotations' as any).insert({
      rfq_id: selectedRfq.id, supplier_id: qf.supplier_id,
      total_price: Number(qf.total_price), delivery_days: Number(qf.delivery_days || 0),
      payment_terms: qf.payment_terms, warranty: qf.warranty,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Quotation recorded' });
    setQuoteOpen(false); setQf({ supplier_id:'', total_price:'', delivery_days:'', payment_terms:'', warranty:'' }); load();
  };

  const pickWinner = async (q: Quote) => {
    await supabase.from('quotations' as any).update({ is_winner: false } as any).eq('rfq_id', q.rfq_id);
    await supabase.from('quotations' as any).update({ is_winner: true } as any).eq('id', q.id);
    await supabase.from('rfqs' as any).update({ status: 'awarded' } as any).eq('id', q.rfq_id);
    toast({ title: 'Winner selected' }); load();
  };

  // weighted scoring: 60% price, 30% delivery, 10% warranty length
  const rfqQuotes = (rfqId: string) => {
    const list = quotes.filter(q => q.rfq_id === rfqId);
    if (list.length === 0) return [];
    const minPrice = Math.min(...list.map(q => q.total_price || Infinity));
    const minDelivery = Math.min(...list.map(q => q.delivery_days || 9999));
    return list.map(q => ({
      ...q,
      score: Math.round((minPrice / (q.total_price || 1)) * 60 + (minDelivery / (q.delivery_days || 1)) * 30 + (q.warranty ? 10 : 0)),
    })).sort((a, b) => b.score - a.score);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Requests for Quotation</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New RFQ</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New RFQ</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>RFQ #</Label><Input value={form.rfq_number} onChange={(e) => setForm({ ...form, rfq_number: e.target.value })} placeholder="RFQ-2026-001" /></div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Closing date</Label><Input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>RFQ #</TableHead><TableHead>Title</TableHead><TableHead>Closing</TableHead><TableHead>Status</TableHead><TableHead>Quotes</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rfqs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No RFQs yet.</TableCell></TableRow>}
              {rfqs.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.rfq_number}</TableCell>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="text-xs">{r.closing_date || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell>{quotes.filter(q => q.rfq_id === r.id).length}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" className="h-7" onClick={() => { setSelectedRfq(r); setQuoteOpen(true); }}>+ Quote</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedRfq && (
        <Card>
          <CardHeader><CardTitle className="text-base">Quotation Comparison — {selectedRfq.rfq_number}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Delivery (days)</TableHead><TableHead>Payment</TableHead><TableHead>Warranty</TableHead><TableHead>Score</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rfqQuotes(selectedRfq.id).length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No quotations yet.</TableCell></TableRow>}
                {rfqQuotes(selectedRfq.id).map(q => {
                  const sup = suppliers.find(s => s.id === q.supplier_id);
                  return (
                    <TableRow key={q.id} className={q.is_winner ? 'bg-success/5' : ''}>
                      <TableCell className="font-medium">{sup?.name || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(q.total_price)}</TableCell>
                      <TableCell>{q.delivery_days}</TableCell>
                      <TableCell className="text-xs">{q.payment_terms || '—'}</TableCell>
                      <TableCell className="text-xs">{q.warranty || '—'}</TableCell>
                      <TableCell><Badge>{q.score}</Badge></TableCell>
                      <TableCell>{q.is_winner ? <Badge className="bg-success/15 text-success">Winner</Badge> : <Button size="sm" variant="ghost" className="h-7" onClick={() => pickWinner(q)}>Pick</Button>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add quotation — {selectedRfq?.rfq_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Supplier</Label>
              <Select value={qf.supplier_id} onValueChange={(v) => setQf({ ...qf, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total price (ETB)</Label><Input type="number" value={qf.total_price} onChange={(e) => setQf({ ...qf, total_price: e.target.value })} /></div>
              <div><Label>Delivery (days)</Label><Input type="number" value={qf.delivery_days} onChange={(e) => setQf({ ...qf, delivery_days: e.target.value })} /></div>
            </div>
            <div><Label>Payment terms</Label><Input value={qf.payment_terms} onChange={(e) => setQf({ ...qf, payment_terms: e.target.value })} placeholder="Net 30" /></div>
            <div><Label>Warranty</Label><Input value={qf.warranty} onChange={(e) => setQf({ ...qf, warranty: e.target.value })} placeholder="1 year" /></div>
          </div>
          <DialogFooter><Button onClick={addQuote}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── POs (existing functionality preserved) ───────── */
function POsTab() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [poOpen, setPoOpen] = useState(false);
  const [poForm, setPoForm] = useState({ po_number: '', supplier_id: '', total: '', notes: '' });

  const load = async () => {
    const [s, p] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchase_orders').select('*').order('order_date', { ascending: false }).limit(100),
    ]);
    setSuppliers((s.data as any) || []); setPos((p.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const addPO = async () => {
    if (!poForm.po_number || !poForm.supplier_id || !poForm.total) { toast({ title: 'PO #, supplier, total required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const total = Number(poForm.total);
    const { error } = await supabase.from('purchase_orders').insert({
      po_number: poForm.po_number, supplier_id: poForm.supplier_id,
      subtotal: total, vat: total * 0.15, total: total * 1.15,
      notes: poForm.notes, status: 'pending_approval', created_by: user?.id,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'PO created' }); setPoOpen(false); setPoForm({ po_number:'', supplier_id:'', total:'', notes:'' }); load();
  };

  const updatePOStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('purchase_orders').update({ status } as any).eq('id', id);
    if (!error) { toast({ title: `PO ${status.replace('_', ' ')}` }); load(); }
  };

  const statusColor: Record<string,string> = { draft:'bg-muted text-muted-foreground', pending_approval:'bg-warning/20 text-warning-foreground', approved:'bg-info/15 text-info', sent:'bg-primary/15 text-primary', partial:'bg-warning/15 text-warning-foreground', delivered:'bg-success/15 text-success', closed:'bg-muted text-muted-foreground', cancelled:'bg-destructive/15 text-destructive' };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Purchase Orders</CardTitle>
        <Dialog open={poOpen} onOpenChange={setPoOpen}>
          <DialogTrigger asChild><Button size="sm" disabled={suppliers.length === 0}><Plus className="w-4 h-4 mr-1" /> New PO</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>PO Number</Label><Input value={poForm.po_number} onChange={(e) => setPoForm({ ...poForm, po_number: e.target.value })} placeholder="PO-2026-001" /></div>
              <div><Label>Supplier</Label>
                <Select value={poForm.supplier_id} onValueChange={(v) => setPoForm({ ...poForm, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Subtotal (ETB)</Label><Input type="number" value={poForm.total} onChange={(e) => setPoForm({ ...poForm, total: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={poForm.notes} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={addPO}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {pos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No POs yet.</TableCell></TableRow>}
            {pos.map(p => {
              const sup = suppliers.find(s => s.id === p.supplier_id);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.po_number}</TableCell>
                  <TableCell className="font-medium">{sup?.name || '—'}</TableCell>
                  <TableCell>{p.order_date}</TableCell>
                  <TableCell><Badge variant="secondary" className={statusColor[p.status]}>{p.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{p.currency} {Number(p.total).toLocaleString()}</TableCell>
                  <TableCell>
                    {p.status === 'pending_approval' && <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => updatePOStatus(p.id, 'approved')}>Approve</Button>}
                    {p.status === 'approved' && <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => updatePOStatus(p.id, 'sent')}>Send</Button>}
                    {p.status === 'sent' && <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => updatePOStatus(p.id, 'delivered')}>Mark Delivered</Button>}
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

/* ───────── Invoices + 3-way match ───────── */
function InvoicesTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [grns, setGrns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoice_number: '', supplier_id: '', po_id: '', grn_id: '', invoice_date: new Date().toISOString().slice(0,10), subtotal: '', vat: '', total: '' });

  const load = async () => {
    const [i, p, g, s] = await Promise.all([
      supabase.from('supplier_invoices' as any).select('*').order('invoice_date', { ascending: false }).limit(100),
      supabase.from('purchase_orders').select('id,po_number,total,supplier_id'),
      supabase.from('goods_receipts').select('id,grn_number,total,po_id,supplier_id'),
      supabase.from('suppliers').select('*'),
    ]);
    setRows((i.data as any) || []); setPos((p.data as any) || []); setGrns((g.data as any) || []); setSuppliers((s.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const runMatch = (inv: Partial<Invoice>) => {
    const po = pos.find(p => p.id === inv.po_id);
    const grn = grns.find(g => g.id === inv.grn_id);
    const tol = 0.02; // 2% tolerance
    const notes: string[] = [];
    let status: 'matched' | 'mismatch' | 'pending' = 'pending';
    if (po && grn) {
      const dPO = Math.abs(Number(inv.total||0) - Number(po.total||0)) / Math.max(Number(po.total||1),1);
      const dGRN = Math.abs(Number(grn.total||0) - Number(po.total||0)) / Math.max(Number(po.total||1),1);
      if (dPO > tol) notes.push(`Invoice vs PO Δ ${(dPO*100).toFixed(1)}%`);
      if (dGRN > tol) notes.push(`GRN vs PO Δ ${(dGRN*100).toFixed(1)}%`);
      status = notes.length ? 'mismatch' : 'matched';
    } else {
      notes.push('Missing PO or GRN reference');
    }
    return { status, notes: notes.join('; ') };
  };

  const create = async () => {
    if (!form.invoice_number || !form.supplier_id || !form.total) { toast({ title: 'Invoice #, supplier and total required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const inv = { ...form, subtotal: Number(form.subtotal||form.total), vat: Number(form.vat||0), total: Number(form.total), po_id: form.po_id || null, grn_id: form.grn_id || null };
    const m = runMatch(inv);
    const { error } = await supabase.from('supplier_invoices' as any).insert({ ...inv, match_status: m.status, match_notes: m.notes, created_by: user?.id } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Invoice saved · ${m.status}` });
    setOpen(false); setForm({ invoice_number:'', supplier_id:'', po_id:'', grn_id:'', invoice_date: new Date().toISOString().slice(0,10), subtotal:'', vat:'', total:'' }); load();
  };

  const approve = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('supplier_invoices' as any).update({ status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() } as any).eq('id', id);
    toast({ title: 'Invoice approved for payment' }); load();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Supplier Invoices · 3-Way Matching</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Auto-compares Invoice ↔ PO ↔ GRN within ±2% tolerance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Invoice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New supplier invoice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Invoice #</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
                <div><Label>Date</Label><Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} /></div>
              </div>
              <div><Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>PO</Label>
                  <Select value={form.po_id || '__none__'} onValueChange={(v) => setForm({ ...form, po_id: v === '__none__' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">None</SelectItem>{pos.filter(p => !form.supplier_id || p.supplier_id === form.supplier_id).map(p => <SelectItem key={p.id} value={p.id}>{p.po_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>GRN</Label>
                  <Select value={form.grn_id || '__none__'} onValueChange={(v) => setForm({ ...form, grn_id: v === '__none__' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">None</SelectItem>{grns.filter(g => !form.po_id || g.po_id === form.po_id).map(g => <SelectItem key={g.id} value={g.id}>{g.grn_number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Subtotal</Label><Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></div>
                <div><Label>VAT</Label><Input type="number" value={form.vat} onChange={(e) => setForm({ ...form, vat: e.target.value })} /></div>
                <div><Label>Total</Label><Input type="number" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Save & Match</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead>PO</TableHead><TableHead>GRN</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Match</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No invoices yet.</TableCell></TableRow>}
            {rows.map(r => {
              const sup = suppliers.find(s => s.id === r.supplier_id);
              const po = pos.find(p => p.id === r.po_id);
              const grn = grns.find(g => g.id === r.grn_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                  <TableCell>{sup?.name || '—'}</TableCell>
                  <TableCell className="text-xs">{r.invoice_date}</TableCell>
                  <TableCell className="text-xs">{po?.po_number || '—'}</TableCell>
                  <TableCell className="text-xs">{grn?.grn_number || '—'}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(r.total))}</TableCell>
                  <TableCell title={r.match_notes}>
                    <Badge variant="secondary" className={r.match_status==='matched'?'bg-success/15 text-success':r.match_status==='mismatch'?'bg-destructive/15 text-destructive':'bg-warning/15 text-warning-foreground'}>
                      {r.match_status === 'matched' ? <CheckCircle2 className="w-3 h-3 mr-1 inline" /> : <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                      {r.match_status}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{r.status}</Badge></TableCell>
                  <TableCell>
                    {r.status === 'pending' && r.match_status === 'matched' && (
                      <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => approve(r.id)}>Approve pay</Button>
                    )}
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

/* ───────── Suppliers + Documents ───────── */
function SuppliersTab() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [supOpen, setSupOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [supForm, setSupForm] = useState({ name:'', code:'', category:'general', phone:'', email:'', tin:'', vat_number:'', payment_terms:'Net 30', lead_time_days:'7' });
  const [docForm, setDocForm] = useState({ doc_type:'trade_license', doc_number:'', issued_date:'', expiry_date:'' });
  const [search, setSearch] = useState('');

  const load = async () => {
    const [s, d] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('supplier_documents' as any).select('*'),
    ]);
    setSuppliers((s.data as any) || []); setDocs((d.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || (s.category||'').toLowerCase().includes(search.toLowerCase())), [suppliers, search]);

  const addSupplier = async () => {
    if (!supForm.name || !supForm.code) { toast({ title: 'Name and code required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('suppliers').insert({ ...supForm, lead_time_days: Number(supForm.lead_time_days||0) } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Supplier created' }); setSupOpen(false);
    setSupForm({ name:'', code:'', category:'general', phone:'', email:'', tin:'', vat_number:'', payment_terms:'Net 30', lead_time_days:'7' }); load();
  };

  const addDoc = async () => {
    if (!activeSupplier || !docForm.doc_type) return;
    const { error } = await supabase.from('supplier_documents' as any).insert({ ...docForm, supplier_id: activeSupplier.id, issued_date: docForm.issued_date || null, expiry_date: docForm.expiry_date || null } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Document added' }); setDocOpen(false); setDocForm({ doc_type:'trade_license', doc_number:'', issued_date:'', expiry_date:'' }); load();
  };

  const today = new Date().toISOString().slice(0,10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Suppliers</CardTitle>
            <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 h-8" />
          </div>
          <Dialog open={supOpen} onOpenChange={setSupOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} /></div>
                  <div><Label>Code</Label><Input value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} placeholder="SUP-001" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>TIN</Label><Input value={supForm.tin} onChange={(e) => setSupForm({ ...supForm, tin: e.target.value })} /></div>
                  <div><Label>VAT #</Label><Input value={supForm.vat_number} onChange={(e) => setSupForm({ ...supForm, vat_number: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Category</Label><Input value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} /></div>
                  <div><Label>Payment terms</Label><Input value={supForm.payment_terms} onChange={(e) => setSupForm({ ...supForm, payment_terms: e.target.value })} /></div>
                  <div><Label>Lead time (days)</Label><Input type="number" value={supForm.lead_time_days} onChange={(e) => setSupForm({ ...supForm, lead_time_days: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={addSupplier}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>TIN/VAT</TableHead><TableHead>Category</TableHead><TableHead>Lead</TableHead><TableHead>Performance</TableHead><TableHead className="text-right">Spend</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No suppliers.</TableCell></TableRow>}
              {filtered.map(s => {
                const sDocs = docs.filter(d => d.supplier_id === s.id);
                const expired = sDocs.some(d => d.expiry_date && d.expiry_date < today);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium">
                      {s.name}
                      {expired && <Badge variant="destructive" className="ml-2 text-[9px]">doc expired</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{s.tin || '—'}<br/><span className="text-muted-foreground">{s.vat_number || ''}</span></TableCell>
                    <TableCell className="text-muted-foreground capitalize">{s.category}</TableCell>
                    <TableCell>{s.lead_time_days || 0}d</TableCell>
                    <TableCell><div className="flex items-center gap-1"><Star className="w-3 h-3 fill-warning text-warning" /> {Number(s.performance_score||s.rating||0).toFixed(1)}</div></TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(s.total_spend))}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" className="h-7" onClick={() => { setActiveSupplier(s); setDocOpen(true); }}><FileText className="w-3 h-3 mr-1" /> Docs ({sDocs.length})</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={docOpen} onOpenChange={setDocOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Compliance documents — {activeSupplier?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>#</TableHead><TableHead>Issued</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
              <TableBody>
                {docs.filter(d => d.supplier_id === activeSupplier?.id).map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="capitalize">{d.doc_type.replace('_',' ')}</TableCell>
                    <TableCell className="font-mono text-xs">{d.doc_number}</TableCell>
                    <TableCell className="text-xs">{d.issued_date || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {d.expiry_date || '—'}
                      {d.expiry_date && d.expiry_date < today && <Badge variant="destructive" className="ml-2 text-[9px]">expired</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t">
              <div><Label>Doc type</Label>
                <Select value={docForm.doc_type} onValueChange={(v) => setDocForm({ ...docForm, doc_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trade_license">Trade License</SelectItem>
                    <SelectItem value="vat_cert">VAT Certificate</SelectItem>
                    <SelectItem value="tin">TIN Certificate</SelectItem>
                    <SelectItem value="iso">ISO / Quality</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Number</Label><Input value={docForm.doc_number} onChange={(e) => setDocForm({ ...docForm, doc_number: e.target.value })} /></div>
              <div><Label>Issued</Label><Input type="date" value={docForm.issued_date} onChange={(e) => setDocForm({ ...docForm, issued_date: e.target.value })} /></div>
              <div><Label>Expiry</Label><Input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={addDoc}>Add document</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── Contracts ───────── */
function ContractsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Contract[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ contract_number:'', supplier_id:'', title:'', start_date: new Date().toISOString().slice(0,10), end_date:'', contract_value:'' });

  const load = async () => {
    const [c, s] = await Promise.all([
      supabase.from('supplier_contracts' as any).select('*').order('end_date', { ascending: true }),
      supabase.from('suppliers').select('*').eq('is_active', true),
    ]);
    setRows((c.data as any) || []); setSuppliers((s.data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.contract_number || !form.supplier_id || !form.title || !form.end_date) { toast({ title: 'All fields required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('supplier_contracts' as any).insert({ ...form, contract_value: Number(form.contract_value||0) } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contract created' }); setOpen(false); setForm({ contract_number:'', supplier_id:'', title:'', start_date: new Date().toISOString().slice(0,10), end_date:'', contract_value:'' }); load();
  };

  const today = new Date().toISOString().slice(0,10);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Supplier Contracts</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Contract</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contract #</Label><Input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} /></div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              </div>
              <div><Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                <div><Label>Value</Label><Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Contract #</TableHead><TableHead>Supplier</TableHead><TableHead>Title</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Used</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No contracts yet.</TableCell></TableRow>}
            {rows.map(c => {
              const sup = suppliers.find(s => s.id === c.supplier_id);
              const expiringSoon = c.end_date <= new Date(Date.now()+30*86400000).toISOString().slice(0,10);
              const expired = c.end_date < today;
              const pct = c.contract_value > 0 ? Math.round((Number(c.used_value)/Number(c.contract_value))*100) : 0;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.contract_number}</TableCell>
                  <TableCell>{sup?.name || '—'}</TableCell>
                  <TableCell>{c.title}</TableCell>
                  <TableCell className="text-xs">{c.start_date} → {c.end_date}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(Number(c.contract_value))}</TableCell>
                  <TableCell>{pct}%</TableCell>
                  <TableCell>
                    {expired ? <Badge variant="destructive">expired</Badge> : expiringSoon ? <Badge className="bg-warning/15 text-warning-foreground">expiring</Badge> : <Badge className="bg-success/15 text-success">active</Badge>}
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

/* ───────── Tenders (external links) ───────── */
function TendersTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Tender[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title:'', source:'2merkato', url:'', deadline:'', notes:'' });

  const load = async () => {
    const { data } = await supabase.from('tender_bookmarks' as any).select('*').order('deadline', { ascending: true });
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title || !form.url) { toast({ title: 'Title and URL required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tender_bookmarks' as any).insert({ ...form, deadline: form.deadline || null, created_by: user?.id } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Tender bookmarked' }); setOpen(false); setForm({ title:'', source:'2merkato', url:'', deadline:'', notes:'' }); load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">2Merkato — Public tenders</p>
              <p className="text-xs text-muted-foreground">Browse Ethiopian tender listings</p>
            </div>
            <Button asChild variant="outline" size="sm"><a href="https://www.2merkato.com/tenders" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open</a></Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">PPA — Government Procurement Portal</p>
              <p className="text-xs text-muted-foreground">Official Ethiopian e-procurement</p>
            </div>
            <Button asChild variant="outline" size="sm"><a href="https://ppa.gov.et/" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open</a></Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Bookmark className="w-4 h-4" /> Tracked tenders</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bookmark a tender</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Source</Label>
                    <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="2merkato">2Merkato</SelectItem><SelectItem value="gov_portal">PPA Portal</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
                </div>
                <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Source</TableHead><TableHead>Deadline</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No bookmarks yet.</TableCell></TableRow>}
              {rows.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}<div className="text-xs text-muted-foreground">{t.notes}</div></TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{t.source.replace('_',' ')}</Badge></TableCell>
                  <TableCell className="text-xs">{t.deadline || '—'}</TableCell>
                  <TableCell><Button asChild variant="ghost" size="sm" className="h-7"><a href={t.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 mr-1" /> Open</a></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── AI Assistant ───────── */
function AiAssistantTab() {
  const [insights, setInsights] = useState<Array<{ icon: any; title: string; detail: string; severity: string }>>([]);
  useEffect(() => { (async () => {
    const today = new Date().toISOString().slice(0,10);
    const in30 = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
    const [pos, contracts, docs, sups, invs] = await Promise.all([
      supabase.from('purchase_orders').select('id,po_number,status,expected_delivery,supplier_id,total'),
      supabase.from('supplier_contracts' as any).select('contract_number,end_date,status'),
      supabase.from('supplier_documents' as any).select('doc_type,expiry_date,supplier_id'),
      supabase.from('suppliers').select('id,name,total_spend,performance_score,rating'),
      supabase.from('supplier_invoices' as any).select('match_status,total'),
    ]);
    const out: any[] = [];
    const overdue = ((pos.data as any[])||[]).filter(p => p.expected_delivery && p.expected_delivery < today && !['delivered','closed','cancelled'].includes(p.status));
    if (overdue.length) out.push({ icon: AlertTriangle, severity: 'warning', title: `${overdue.length} overdue deliveries`, detail: overdue.slice(0,3).map(p => p.po_number).join(', ') });
    const expC = ((contracts.data as any[])||[]).filter(c => c.status==='active' && c.end_date <= in30);
    if (expC.length) out.push({ icon: FileText, severity: 'warning', title: `${expC.length} contracts expiring within 30 days`, detail: expC.slice(0,3).map(c => c.contract_number).join(', ') });
    const expD = ((docs.data as any[])||[]).filter(d => d.expiry_date && d.expiry_date <= in30);
    if (expD.length) out.push({ icon: ShieldCheck, severity: 'warning', title: `${expD.length} compliance documents expiring soon`, detail: '' });
    const sList = (sups.data as any[])||[];
    const top = [...sList].sort((a,b) => Number(b.total_spend)-Number(a.total_spend)).slice(0,3);
    if (top.length) out.push({ icon: Award, severity: 'info', title: 'Top suppliers by spend', detail: top.map(s => `${s.name} (${fmt(Number(s.total_spend))})`).join(' · ') });
    const mismatch = ((invs.data as any[])||[]).filter(i => i.match_status === 'mismatch');
    if (mismatch.length) out.push({ icon: AlertTriangle, severity: 'destructive', title: `${mismatch.length} invoices with 3-way mismatches`, detail: 'Review before paying' });
    if (out.length === 0) out.push({ icon: CheckCircle2, severity: 'success', title: 'All clear', detail: 'No procurement anomalies detected.' });
    setInsights(out);
  })(); }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Procurement Insights</CardTitle>
        <p className="text-xs text-muted-foreground">Anomaly detection across your live procurement data.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((i, idx) => {
          const Icon = i.icon;
          const cls = i.severity === 'destructive' ? 'border-destructive/30 bg-destructive/5' : i.severity === 'warning' ? 'border-warning/30 bg-warning/5' : i.severity === 'success' ? 'border-success/30 bg-success/5' : 'border-primary/30 bg-primary/5';
          return (
            <Alert key={idx} className={cls}>
              <AlertDescription className="flex items-start gap-2">
                <Icon className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">{i.title}</p>
                  {i.detail && <p className="text-xs text-muted-foreground mt-0.5">{i.detail}</p>}
                </div>
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
