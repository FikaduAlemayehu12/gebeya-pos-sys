import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus } from 'lucide-react';
import { toast } from 'sonner';

type Component = { id: string; code: string; name: string; kind: string; category: string; is_taxable: boolean; is_pensionable: boolean; default_amount: number };
type Structure = { id: string; employee_id: string; component_id: string; amount: number; percent_of_basic: number | null; effective_from: string; effective_to: string | null };
type Advance = { id: string; employee_id: string; amount: number; reason: string | null; installments: number; recovered_amount: number; status: string };
type Bonus = { id: string; employee_id: string; amount: number; reason: string | null; is_taxable: boolean; status: string };

export default function Salary() {
  const [tab, setTab] = useState('components');
  const [components, setComponents] = useState<Component[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [cOpen, setCOpen] = useState(false); const [cDraft, setCDraft] = useState<Partial<Component>>({ kind: 'earning', category: 'allowance', is_taxable: true });
  const [sOpen, setSOpen] = useState(false); const [sDraft, setSDraft] = useState<Partial<Structure>>({});
  const [aOpen, setAOpen] = useState(false); const [aDraft, setADraft] = useState<Partial<Advance>>({ installments: 1 });
  const [bOpen, setBOpen] = useState(false); const [bDraft, setBDraft] = useState<Partial<Bonus>>({ is_taxable: true });

  useEffect(() => { load(); }, []);
  async function load() {
    const [c, s, a, b, e] = await Promise.all([
      supabase.from('salary_components').select('*').order('code'),
      supabase.from('employee_salary_structure').select('*'),
      supabase.from('salary_advances').select('*').order('created_at', { ascending: false }),
      supabase.from('bonuses').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, full_name').eq('status', 'active'),
    ]);
    setComponents((c.data || []) as any);
    setStructures((s.data || []) as any);
    setAdvances((a.data || []) as any);
    setBonuses((b.data || []) as any);
    setEmployees(e.data || []);
  }

  async function saveComponent() {
    if (!cDraft.code || !cDraft.name) return toast.error('Code & name required');
    const { error } = await supabase.from('salary_components').insert(cDraft as any);
    if (error) return toast.error(error.message);
    toast.success('Component saved'); setCOpen(false); setCDraft({ kind: 'earning', category: 'allowance', is_taxable: true }); load();
  }
  async function saveStructure() {
    if (!sDraft.employee_id || !sDraft.component_id) return toast.error('Employee & component required');
    const { error } = await supabase.from('employee_salary_structure').insert(sDraft as any);
    if (error) return toast.error(error.message);
    toast.success('Assigned'); setSOpen(false); setSDraft({}); load();
  }
  async function saveAdvance() {
    if (!aDraft.employee_id || !aDraft.amount) return toast.error('Employee & amount required');
    const { error } = await supabase.from('salary_advances').insert(aDraft as any);
    if (error) return toast.error(error.message);
    toast.success('Advance requested'); setAOpen(false); setADraft({ installments: 1 }); load();
  }
  async function saveBonus() {
    if (!bDraft.employee_id || !bDraft.amount) return toast.error('Employee & amount required');
    const { error } = await supabase.from('bonuses').insert(bDraft as any);
    if (error) return toast.error(error.message);
    toast.success('Bonus added'); setBOpen(false); setBDraft({ is_taxable: true }); load();
  }
  async function decide(kind: 'advance' | 'bonus', id: string, status: string) {
    const table = kind === 'advance' ? 'salary_advances' : 'bonuses';
    const { data: { user } } = await supabase.auth.getUser();
    const patch: any = { status, approved_by: user?.id, approved_at: new Date().toISOString() };
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Updated'); load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6" /> Salary Management</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="structures">Structures</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="bonuses">Bonuses</TabsTrigger>
        </TabsList>

        <TabsContent value="components">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Salary Components</CardTitle>
              <Dialog open={cOpen} onOpenChange={setCOpen}><DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Component</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Code (BASIC, HRA)" value={cDraft.code || ''} onChange={(e) => setCDraft({ ...cDraft, code: e.target.value.toUpperCase() })} />
                      <Input placeholder="Name" value={cDraft.name || ''} onChange={(e) => setCDraft({ ...cDraft, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={cDraft.kind} onValueChange={(v) => setCDraft({ ...cDraft, kind: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="earning">Earning</SelectItem><SelectItem value="deduction">Deduction</SelectItem></SelectContent>
                      </Select>
                      <Select value={cDraft.category} onValueChange={(v) => setCDraft({ ...cDraft, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{['basic','allowance','bonus','overtime','deduction','statutory'].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Input type="number" placeholder="Default amount" value={cDraft.default_amount ?? ''} onChange={(e) => setCDraft({ ...cDraft, default_amount: Number(e.target.value) })} />
                    <div className="flex gap-3 text-sm">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={!!cDraft.is_taxable} onChange={(e) => setCDraft({ ...cDraft, is_taxable: e.target.checked })} /> Taxable</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={!!cDraft.is_pensionable} onChange={(e) => setCDraft({ ...cDraft, is_pensionable: e.target.checked })} /> Pensionable</label>
                    </div>
                  </div>
                  <DialogFooter><Button onClick={saveComponent}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Code</th><th>Name</th><th>Kind</th><th>Category</th><th>Default</th><th>Flags</th></tr></thead>
                <tbody>
                  {components.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="p-2 font-mono text-xs">{c.code}</td><td>{c.name}</td>
                      <td><Badge variant={c.kind === 'earning' ? 'default' : 'destructive'}>{c.kind}</Badge></td>
                      <td className="capitalize">{c.category}</td><td>{Number(c.default_amount).toLocaleString()}</td>
                      <td className="text-xs">{c.is_taxable && 'Tax '}{c.is_pensionable && 'Pen'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Employee Salary Structures</CardTitle>
              <Dialog open={sOpen} onOpenChange={setSOpen}><DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Assign</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign Component</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Select value={sDraft.employee_id} onValueChange={(v) => setSDraft({ ...sDraft, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={sDraft.component_id} onValueChange={(v) => setSDraft({ ...sDraft, component_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Component" /></SelectTrigger>
                      <SelectContent>{components.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Amount" value={sDraft.amount ?? ''} onChange={(e) => setSDraft({ ...sDraft, amount: Number(e.target.value) })} />
                      <Input type="number" placeholder="% of basic (opt)" value={sDraft.percent_of_basic ?? ''} onChange={(e) => setSDraft({ ...sDraft, percent_of_basic: Number(e.target.value) })} />
                    </div>
                    <Input type="date" value={sDraft.effective_from || ''} onChange={(e) => setSDraft({ ...sDraft, effective_from: e.target.value })} />
                  </div>
                  <DialogFooter><Button onClick={saveStructure}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Employee</th><th>Component</th><th>Amount</th><th>% Basic</th><th>From</th></tr></thead>
                <tbody>
                  {structures.map((s) => {
                    const emp = employees.find((e) => e.id === s.employee_id);
                    const comp = components.find((c) => c.id === s.component_id);
                    return (
                      <tr key={s.id} className="border-b">
                        <td className="p-2">{emp?.full_name || '—'}</td><td>{comp?.code} {comp?.name}</td>
                        <td>{Number(s.amount).toLocaleString()}</td><td>{s.percent_of_basic ?? '—'}</td><td>{s.effective_from}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Salary Advances</CardTitle>
              <Dialog open={aOpen} onOpenChange={setAOpen}><DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Request</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Advance Request</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Select value={aDraft.employee_id} onValueChange={(v) => setADraft({ ...aDraft, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Amount" value={aDraft.amount ?? ''} onChange={(e) => setADraft({ ...aDraft, amount: Number(e.target.value) })} />
                      <Input type="number" placeholder="Installments" value={aDraft.installments} onChange={(e) => setADraft({ ...aDraft, installments: Number(e.target.value) })} />
                    </div>
                    <Textarea placeholder="Reason" value={aDraft.reason || ''} onChange={(e) => setADraft({ ...aDraft, reason: e.target.value })} />
                  </div>
                  <DialogFooter><Button onClick={saveAdvance}>Submit</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Employee</th><th>Amount</th><th>Installments</th><th>Recovered</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {advances.map((a) => {
                    const emp = employees.find((e) => e.id === a.employee_id);
                    return (
                      <tr key={a.id} className="border-b">
                        <td className="p-2">{emp?.full_name || '—'}</td><td>{Number(a.amount).toLocaleString()}</td>
                        <td>{a.installments}</td><td>{Number(a.recovered_amount).toLocaleString()}</td>
                        <td><Badge variant="outline">{a.status}</Badge></td>
                        <td className="space-x-1">
                          {a.status === 'pending' && (<>
                            <Button size="sm" variant="outline" onClick={() => decide('advance', a.id, 'approved')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => decide('advance', a.id, 'rejected')}>Reject</Button>
                          </>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bonuses">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Bonuses</CardTitle>
              <Dialog open={bOpen} onOpenChange={setBOpen}><DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Bonus</DialogTitle></DialogHeader>
                  <div className="space-y-2">
                    <Select value={bDraft.employee_id} onValueChange={(v) => setBDraft({ ...bDraft, employee_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Employee" /></SelectTrigger>
                      <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" placeholder="Amount" value={bDraft.amount ?? ''} onChange={(e) => setBDraft({ ...bDraft, amount: Number(e.target.value) })} />
                    <Textarea placeholder="Reason" value={bDraft.reason || ''} onChange={(e) => setBDraft({ ...bDraft, reason: e.target.value })} />
                    <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={!!bDraft.is_taxable} onChange={(e) => setBDraft({ ...bDraft, is_taxable: e.target.checked })} /> Taxable</label>
                  </div>
                  <DialogFooter><Button onClick={saveBonus}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Employee</th><th>Amount</th><th>Reason</th><th>Taxable</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {bonuses.map((b) => {
                    const emp = employees.find((e) => e.id === b.employee_id);
                    return (
                      <tr key={b.id} className="border-b">
                        <td className="p-2">{emp?.full_name || '—'}</td><td>{Number(b.amount).toLocaleString()}</td>
                        <td className="text-xs">{b.reason}</td><td>{b.is_taxable ? 'Yes' : 'No'}</td>
                        <td><Badge variant="outline">{b.status}</Badge></td>
                        <td className="space-x-1">
                          {b.status === 'pending' && (<>
                            <Button size="sm" variant="outline" onClick={() => decide('bonus', b.id, 'approved')}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => decide('bonus', b.id, 'cancelled')}>Cancel</Button>
                          </>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
