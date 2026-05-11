import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, FileText, Send, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Download, Repeat, Activity } from 'lucide-react';
import StatCard from '@/components/StatCard';
import { Link } from 'react-router-dom';
import { exportCSV, exportXLSX } from '@/lib/exporters';

const fmt = (n: number) => `ETB ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function ComplianceTab({ canApprove }: { canApprove: boolean }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [voidedSales, setVoidedSales] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, c, v, q] = await Promise.all([
      supabase.from('invoice_void_requests').select('*').order('requested_at', { ascending: false }).limit(100),
      supabase.from('credit_notes').select('*').order('issued_at', { ascending: false }).limit(100),
      supabase.from('sales').select('id, receipt_id, total, voided_at, void_reason, mor_sync_status, voided_by, payment_method').eq('status', 'void').order('voided_at', { ascending: false }).limit(100),
      supabase.from('mor_sync_queue').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setRequests((r.data as any) || []);
    setCreditNotes((c.data as any) || []);
    setVoidedSales((v.data as any) || []);
    setQueue((q.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const review = async (decision: 'approve' | 'reject') => {
    if (!reviewItem) return;
    setBusy(true);
    const { error } = await supabase.rpc('approve_void_request', {
      _request_id: reviewItem.id,
      _decision: decision,
      _notes: reviewNotes,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Action failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: decision === 'approve' ? 'Void approved' : 'Request rejected' });
    setReviewItem(null); setReviewNotes('');
    load();
  };

  const requeue = async (id: string) => {
    const { error } = await supabase.rpc('mor_requeue', { _id: id });
    if (error) { toast({ title: 'Requeue failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Requeued for retry' });
    load();
  };

  const runWorkerNow = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('mor-sync-worker', { body: {} });
    setBusy(false);
    if (error) { toast({ title: 'Worker failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'MoR worker run', description: `Processed ${data?.processed || 0}; sent ${data?.sent || 0}, failed ${data?.failed || 0}, dead ${data?.dead || 0}.` });
    load();
  };

  const exportData = (kind: 'csv' | 'xlsx', tab: 'voided' | 'credit-notes' | 'mor' | 'requests') => {
    const rows =
      tab === 'voided' ? voidedSales :
      tab === 'credit-notes' ? creditNotes :
      tab === 'requests' ? requests :
      queue;
    if (!rows.length) { toast({ title: 'Nothing to export' }); return; }
    const filename = `mor-${tab}-${new Date().toISOString().slice(0,10)}`;
    kind === 'csv' ? exportCSV(rows, filename) : exportXLSX(rows, filename, tab);
  };

  const pending = requests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Pending approvals" value={String(pending.length)} icon={Clock} variant="warning" />
        <StatCard title="Credit notes" value={String(creditNotes.length)} icon={FileText} variant="primary" />
        <StatCard title="Voided invoices" value={String(voidedSales.length)} icon={ShieldAlert} variant="destructive" />
        <StatCard title="MoR queue (pending)" value={String(queue.filter(q => q.status === 'pending').length)} icon={Send} variant="default" />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Compliance with MoR Directive 1099/2025 — invoice voids, credit notes, and Ministry of Revenues sync.
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Approval queue {pending.length > 0 && <Badge variant="destructive" className="ml-1.5">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="voided">Voided invoices</TabsTrigger>
          <TabsTrigger value="credit-notes">Credit notes</TabsTrigger>
          <TabsTrigger value="mor">MoR sync</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card><CardHeader><CardTitle className="text-base">Late void requests (&gt;7 days)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Filed</TableHead><TableHead>Receipt</TableHead><TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {requests.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No void requests.</TableCell></TableRow>}
                  {requests.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.requested_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs"><Link to={`/receipt/${r.receipt_id}`} className="underline">{r.receipt_id}</Link></TableCell>
                      <TableCell><Badge variant="destructive">{r.days_since_invoice}d</Badge></TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{r.reason}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'approved' ? 'default' : 'outline'}>{r.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.status === 'pending' && canApprove && (
                          <Button size="sm" variant="outline" onClick={() => setReviewItem(r)}>Review</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voided">
          <Card><CardHeader><CardTitle className="text-base">Voided invoices</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Voided at</TableHead><TableHead>Receipt</TableHead><TableHead>Total</TableHead>
                  <TableHead>Reason</TableHead><TableHead>MoR sync</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {voidedSales.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">None.</TableCell></TableRow>}
                  {voidedSales.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs whitespace-nowrap">{s.voided_at ? new Date(s.voided_at).toLocaleString() : '—'}</TableCell>
                      <TableCell className="font-mono text-xs"><Link to={`/receipt/${s.receipt_id}`} className="underline">{s.receipt_id}</Link></TableCell>
                      <TableCell className="text-xs">{fmt(s.total)}</TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{s.void_reason}</TableCell>
                      <TableCell>
                        <Badge variant={s.mor_sync_status === 'sent' ? 'default' : 'secondary'}>{s.mor_sync_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit-notes">
          <Card><CardHeader><CardTitle className="text-base">Credit notes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Issued</TableHead><TableHead>Number</TableHead><TableHead>Original receipt</TableHead>
                  <TableHead>Total</TableHead><TableHead>VAT</TableHead><TableHead>Reason</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {creditNotes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">None.</TableCell></TableRow>}
                  {creditNotes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(c.issued_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{c.credit_note_number}</TableCell>
                      <TableCell className="font-mono text-xs"><Link to={`/receipt/${c.original_receipt_id}`} className="underline">{c.original_receipt_id}</Link></TableCell>
                      <TableCell className="text-xs">{fmt(c.total)}</TableCell>
                      <TableCell className="text-xs">{fmt(c.vat)}</TableCell>
                      <TableCell className="text-xs max-w-[260px] truncate">{c.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mor">
          <Card><CardHeader><CardTitle className="text-base">MoR sync queue</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Outbound queue for the Ministry of Revenues real-time API. Mark items as sent once the integration confirms delivery.
              </p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Created</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {queue.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Queue empty.</TableCell></TableRow>}
                  {queue.map(q => (
                    <TableRow key={q.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(q.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{q.document_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{q.reference}</TableCell>
                      <TableCell>
                        <Badge variant={q.status === 'sent' ? 'default' : q.status === 'failed' ? 'destructive' : 'secondary'}>{q.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{q.attempts}</TableCell>
                      <TableCell>
                        {q.status !== 'sent' && canApprove && (
                          <Button size="sm" variant="outline" onClick={() => markSent(q.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark sent
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewItem} onOpenChange={(o) => !o && !busy && setReviewItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review void request</DialogTitle></DialogHeader>
          {reviewItem && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Receipt:</span> <span className="font-mono">{reviewItem.receipt_id}</span></div>
              <div><span className="text-muted-foreground">Filed:</span> {new Date(reviewItem.requested_at).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Days since invoice:</span> <Badge variant="destructive">{reviewItem.days_since_invoice}</Badge></div>
              <div><span className="text-muted-foreground">Reason:</span><p className="mt-1 p-2 bg-muted rounded text-xs">{reviewItem.reason}</p></div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Admin notes</label>
                <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} placeholder="Optional notes..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => review('reject')} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4 mr-1" /> Reject</>}
            </Button>
            <Button variant="destructive" onClick={() => review('approve')} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-1" /> Approve & void</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
