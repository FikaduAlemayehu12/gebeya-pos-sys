import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Users, Pencil } from 'lucide-react';
import { toast } from 'sonner';

type Dept = { id: string; code: string; name: string; parent_id: string | null; manager_user_id: string | null; budget: number; description: string | null; is_active: boolean };

export default function Departments() {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [users, setUsers] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Dept>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepts((data || []) as Dept[]);
    const { data: emps } = await supabase.from('employees').select('department_id');
    const c: Record<string, number> = {};
    (emps || []).forEach((e: any) => { if (e.department_id) c[e.department_id] = (c[e.department_id] || 0) + 1; });
    setCounts(c);
    const { data: p } = await supabase.from('profiles').select('user_id, full_name');
    setUsers((p || []) as any);
  }

  async function save() {
    if (!editing.name || !editing.code) { toast.error('Name & code required'); return; }
    const payload = { ...editing, budget: Number(editing.budget || 0) };
    const { error } = editing.id
      ? await supabase.from('departments').update(payload).eq('id', editing.id)
      : await supabase.from('departments').insert(payload as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Saved'); setOpen(false); setEditing({}); load();
  }

  const rootDepts = depts.filter((d) => !d.parent_id);
  const childDepts = (parentId: string) => depts.filter((d) => d.parent_id === parentId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6" /> Departments</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing({}); }}>
          <DialogTrigger asChild><Button onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> New Department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? 'Edit' : 'New'} Department</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Code (e.g., ENG)" value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
                <Input placeholder="Name" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <Select value={editing.parent_id || 'none'} onValueChange={(v) => setEditing({ ...editing, parent_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Parent department" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (top level) —</SelectItem>
                  {depts.filter((d) => d.id !== editing.id).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={editing.manager_user_id || 'none'} onValueChange={(v) => setEditing({ ...editing, manager_user_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {users.map((u) => <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.user_id.slice(0, 8)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Budget (ETB)" value={editing.budget ?? ''} onChange={(e) => setEditing({ ...editing, budget: Number(e.target.value) })} />
              <Textarea placeholder="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {rootDepts.map((d) => (
          <Card key={d.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">{d.name} <span className="text-xs text-muted-foreground font-normal">({d.code})</span></CardTitle>
                <p className="text-xs text-muted-foreground">{d.description}</p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {counts[d.id] || 0}</span>
                <span className="text-muted-foreground">Budget: {d.budget?.toLocaleString()} ETB</span>
                <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              </div>
            </CardHeader>
            {childDepts(d.id).length > 0 && (
              <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 pl-8">
                {childDepts(d.id).map((c) => (
                  <div key={c.id} className="border rounded-md p-2 flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">{counts[c.id] || 0} members</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
        {!rootDepts.length && <Card><CardContent className="py-12 text-center text-muted-foreground">No departments yet.</CardContent></Card>}
      </div>
    </div>
  );
}
