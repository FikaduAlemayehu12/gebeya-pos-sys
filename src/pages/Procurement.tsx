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
import { Truck, Package, Award, Plus, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Supplier = { id: string; name: string; code: string; category: string; phone: string; email: string; rating: number; total_orders: number; total_spend: number; is_active: boolean; license_expiry: string | null };
type PO = { id: string; po_number: string; supplier_id: string; order_date: string; expected_delivery: string | null; status: string; total: number; currency: string };

export default function Procurement() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [supOpen, setSupOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [supForm, setSupForm] = useState({ name: '', code: '', category: 'general', phone: '', email: '' });
  const [poForm, setPoForm] = useState({ po_number: '', supplier_id: '', total: '', notes: '' });

  const fetchAll = async () => {
    const [s, p] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchase_orders').select('*').order('order_date', { ascending: false }).limit(50),
    ]);
    setSuppliers((s.data as any) || []);
    setPos((p.data as any) || []);
  };
  useEffect(() => { fetchAll(); }, []);

  const totals = useMemo(() => ({
    activeSuppliers: suppliers.filter(s => s.is_active).length,
    totalSpend: suppliers.reduce((acc, s) => acc + Number(s.total_spend), 0),
    activePOs: pos.filter(p => ['approved', 'sent', 'partial'].includes(p.status)).length,
    pending: pos.filter(p => p.status === 'pending_approval').length,
  }), [suppliers, pos]);

  const fmt = (n: number) => `ETB ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const addSupplier = async () => {
    if (!supForm.name || !supForm.code) { toast({ title: 'Name and code required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('suppliers').insert(supForm as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Supplier created' });
    setSupOpen(false); setSupForm({ name: '', code: '', category: 'general', phone: '', email: '' });
    fetchAll();
  };

  const addPO = async () => {
    if (!poForm.po_number || !poForm.supplier_id || !poForm.total) { toast({ title: 'PO #, supplier, total required', variant: 'destructive' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const total = Number(poForm.total);
    const { error } = await supabase.from('purchase_orders').insert({
      po_number: poForm.po_number,
      supplier_id: poForm.supplier_id,
      subtotal: total,
      vat: total * 0.15,
      total: total * 1.15,
      notes: poForm.notes,
      status: 'pending_approval',
      created_by: user?.id,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Purchase order created' });
    setPoOpen(false); setPoForm({ po_number: '', supplier_id: '', total: '', notes: '' });
    fetchAll();
  };

  const updatePOStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('purchase_orders').update({ status } as any).eq('id', id);
    if (!error) { toast({ title: `PO ${status.replace('_', ' ')}` }); fetchAll(); }
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    pending_approval: 'bg-warning/20 text-warning-foreground',
    approved: 'bg-info/15 text-info',
    sent: 'bg-primary/15 text-primary',
    partial: 'bg-warning/15 text-warning-foreground',
    delivered: 'bg-success/15 text-success',
    closed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-destructive/15 text-destructive',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Truck className="w-6 h-6 text-primary" /> Procurement</h1>
        <p className="text-sm text-muted-foreground mt-1">Suppliers, purchase orders, and goods receipts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Suppliers" value={totals.activeSuppliers} icon={Award} variant="success" />
        <StatCard label="Active POs" value={totals.activePOs} icon={Package} variant="info" />
        <StatCard label="Pending Approval" value={totals.pending} icon={Truck} variant="warning" />
        <StatCard label="Total Spend" value={fmt(totals.totalSpend)} icon={Star} variant="default" />
      </div>

      <Tabs defaultValue="pos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="pos">
          <Card className="stat-card-shadow">
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
                <TableHeader><TableRow>
                  <TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader>
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
                          {p.status === 'pending_approval' && (
                            <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => updatePOStatus(p.id, 'approved')}>Approve</Button>
                          )}
                          {p.status === 'approved' && (
                            <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => updatePOStatus(p.id, 'sent')}>Send</Button>
                          )}
                          {p.status === 'sent' && (
                            <Button size="sm" variant="ghost" className="h-7 text-success" onClick={() => updatePOStatus(p.id, 'delivered')}>Mark Delivered</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card className="stat-card-shadow">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Suppliers</CardTitle>
              <Dialog open={supOpen} onOpenChange={setSupOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Supplier</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} /></div>
                    <div><Label>Code</Label><Input value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} placeholder="SUP-001" /></div>
                    <div><Label>Category</Label><Input value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Phone</Label><Input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} /></div>
                      <div><Label>Email</Label><Input value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} /></div>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={addSupplier}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Contact</TableHead><TableHead>Rating</TableHead><TableHead className="text-right">Spend</TableHead></TableRow></TableHeader>
                <TableBody>
                  {suppliers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No suppliers yet.</TableCell></TableRow>}
                  {suppliers.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{s.category}</TableCell>
                      <TableCell className="text-xs">{s.phone}<br /><span className="text-muted-foreground">{s.email}</span></TableCell>
                      <TableCell><div className="flex items-center gap-1"><Star className="w-3 h-3 fill-gold text-gold" /> {Number(s.rating).toFixed(1)}</div></TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(s.total_spend))}</TableCell>
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
