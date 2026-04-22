import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Building2, Plus, MapPin, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Branch = { id: string; name: string; code: string; address: string; city: string; phone: string; is_active: boolean };

export default function Branches() {
  const { toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', city: '', phone: '' });

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('name');
    setBranches((data as any) || []);
  };
  useEffect(() => { fetchBranches(); }, []);

  const addBranch = async () => {
    if (!form.name || !form.code) { toast({ title: 'Name and code required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('branches').insert(form as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Branch created' });
    setOpen(false); setForm({ name: '', code: '', address: '', city: '', phone: '' });
    fetchBranches();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" /> Branches</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your locations across the country.</p>
        </div>
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
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={addBranch}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3 stat-card-shadow"><CardContent className="py-12 text-center text-muted-foreground">No branches yet. Click "New Branch" to add your first location.</CardContent></Card>
        )}
        {branches.map(b => (
          <Card key={b.id} className="stat-card-shadow hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{b.code}</p>
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

      <Card className="stat-card-shadow">
        <CardHeader><CardTitle className="text-base">All Branches</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {branches.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">{b.code}</TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.city || '—'}</TableCell>
                  <TableCell>{b.phone || '—'}</TableCell>
                  <TableCell><Badge variant="secondary" className={b.is_active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}>{b.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
