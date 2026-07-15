import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, UsersRound } from 'lucide-react';

type Emp = { id: string; employee_code: string; full_name: string; email: string | null; phone: string | null; position: string | null; department: string | null; photo_url?: string | null };

export default function Team() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [depts, setDepts] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [dept, setDept] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('employees').select('id, employee_code, full_name, email, phone, position, department_id, photo_url').eq('status', 'active').order('full_name');
      setEmps((data || []) as Emp[]);
      const { data: d } = await supabase.from('departments').select('id, name');
      setDepts(Object.fromEntries((d || []).map((x: any) => [x.id, x.name])));
    })();
  }, []);

  const filtered = emps.filter((e) => {
    const s = q.toLowerCase();
    if (dept !== 'all' && e.department_id !== dept) return false;
    return !s || e.full_name?.toLowerCase().includes(s) || e.position?.toLowerCase().includes(s) || e.employee_code?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><UsersRound className="w-6 h-6" /> Team Directory</h1>
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name, position, code..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <div className="flex gap-1 flex-wrap">
          <Badge variant={dept === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setDept('all')}>All</Badge>
          {Object.entries(depts).map(([id, name]) => (
            <Badge key={id} variant={dept === id ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setDept(id)}>{name}</Badge>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((e) => (
          <Card key={e.id}>
            <CardContent className="p-4 flex gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold shrink-0 overflow-hidden">
                {e.photo_url ? <img src={e.photo_url} alt={e.full_name} className="w-full h-full object-cover" /> : (e.full_name || '?')[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{e.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{e.position || '—'}</div>
                <div className="text-[11px] text-muted-foreground">{depts[e.department_id || ''] || 'Unassigned'} · {e.employee_code}</div>
                <div className="flex flex-col gap-0.5 mt-1 text-[11px] text-muted-foreground">
                  {e.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {e.email}</span>}
                  {e.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {e.phone}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!filtered.length && <div className="col-span-full text-center py-12 text-muted-foreground">No members found.</div>}
      </div>
    </div>
  );
}
