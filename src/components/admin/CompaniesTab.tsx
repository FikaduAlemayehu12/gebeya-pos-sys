import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Loader2, Building2, Check } from 'lucide-react';

interface CompanyRow {
  id: string;
  name: string;
  code: string;
  currency: string;
  plan: string;
  status: string;
  member_count: number;
}

export default function CompaniesTab() {
  const { toast } = useToast();
  const { activeCompany, refreshCompanies, switchCompany } = useAuth();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', currency: 'ETB' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: list } = await supabase
      .from('companies')
      .select('id, name, code, currency, plan, status')
      .order('created_at', { ascending: false });
    if (!list) { setLoading(false); return; }
    const ids = list.map((c: any) => c.id);
    const { data: members } = await supabase
      .from('company_members')
      .select('company_id')
      .in('company_id', ids);
    const counts: Record<string, number> = {};
    (members || []).forEach((m: any) => { counts[m.company_id] = (counts[m.company_id] || 0) + 1; });
    setCompanies(list.map((c: any) => ({ ...c, member_count: counts[c.id] || 0 })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!form.name || !form.code) {
      toast({ title: 'Name and code are required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }
    const { data: created, error } = await supabase
      .from('companies')
      .insert({ name: form.name, code: form.code.toUpperCase(), currency: form.currency, created_by: user.id } as any)
      .select()
      .single();
    if (error || !created) {
      toast({ title: 'Error', description: error?.message, variant: 'destructive' });
      setCreating(false);
      return;
    }
    // add caller as owner
    await supabase.from('company_members').insert({
      company_id: created.id,
      user_id: user.id,
      member_role: 'owner',
      is_default: false,
    } as any);
    toast({ title: '✅ Company created', description: `${form.name} is ready` });
    setForm({ name: '', code: '', currency: 'ETB' });
    setOpen(false);
    await fetchAll();
    await refreshCompanies();
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Companies</h2>
          <p className="text-xs text-muted-foreground">Each company is fully isolated — its own products, customers, finance, and HR data.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs gradient-primary text-primary-foreground">
              <Plus className="w-3.5 h-3.5" /> New Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Company</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Trading PLC" /></div>
              <div><Label>Short code *</Label><Input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="ACME" /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} placeholder="ETB" /></div>
              <Button onClick={handleCreate} disabled={creating} className="gradient-primary text-primary-foreground">
                {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((c) => (
            <Card key={c.id} className="bg-card">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center text-primary-foreground">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      {activeCompany?.id === c.id && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.code} · {c.currency}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge variant="outline" className="text-[10px] capitalize">{c.plan}</Badge>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{c.status}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{c.member_count} member{c.member_count === 1 ? '' : 's'}</Badge>
                </div>
                {activeCompany?.id !== c.id && (
                  <Button size="sm" variant="outline" className="w-full mt-3 text-xs" onClick={() => switchCompany(c.id)}>
                    Switch to this company
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
