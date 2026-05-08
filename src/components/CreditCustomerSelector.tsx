import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, Users, Loader2, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatETB } from '@/lib/ethiopian';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  name_am: string | null;
  phone: string;
  trust: number;
  credit_balance: number;
  photo_url: string | null;
}

interface Props {
  onSelectCustomer: (customer: Customer, dueDate: string) => void;
  onAddNewCustomer?: () => void; // legacy fallback
  total: number;
}

// Trust 1..5 → max credit (ETB)
const TRUST_LIMITS: Record<number, number> = { 1: 1000, 2: 5000, 3: 15000, 4: 50000, 5: 200000 };

export default function CreditCustomerSelector({ onSelectCustomer, total }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [creating, setCreating] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', name_am: '', phone: '', trust: 3, gov_id: '' });

  useEffect(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('id, name, name_am, phone, trust, credit_balance, photo_url')
      .order('name');
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  };
  useEffect(() => { reload(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.name_am || '').includes(search) ||
    c.phone.includes(search)
  );

  const limit = selected ? TRUST_LIMITS[selected.trust || 3] : 0;
  const exposure = (selected?.credit_balance || 0) + total;
  const overLimit = !!selected && exposure > limit;

  const handleConfirm = () => {
    if (!selected || !dueDate) return;
    if (overLimit) {
      toast({ title: 'Credit limit exceeded', description: `Limit ${formatETB(limit)}. After this sale: ${formatETB(exposure)}`, variant: 'destructive' });
      return;
    }
    onSelectCustomer(selected, dueDate);
  };

  const createInline = async () => {
    if (!newCust.name || !newCust.phone) {
      toast({ title: 'Name & phone required', variant: 'destructive' }); return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: newCust.name, name_am: newCust.name_am, phone: newCust.phone,
        trust: newCust.trust, gov_id: newCust.gov_id, credit_balance: 0, created_by: user?.id,
      } as any)
      .select('id, name, name_am, phone, trust, credit_balance, photo_url')
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: 'Create failed', description: error?.message, variant: 'destructive' }); return;
    }
    toast({ title: '✅ Customer created' });
    setSelected(data as any);
    setMode('pick');
    reload();
  };

  if (mode === 'new') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setMode('pick')} className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <span className="text-xs font-medium text-foreground">New Credit Customer</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Name *</Label><Input className="h-8 text-sm" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} /></div>
          <div><Label className="text-xs">Amharic</Label><Input className="h-8 text-sm font-ethiopic" value={newCust.name_am} onChange={e => setNewCust({ ...newCust, name_am: e.target.value })} /></div>
          <div><Label className="text-xs">Phone *</Label><Input className="h-8 text-sm" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} placeholder="0911..." /></div>
          <div><Label className="text-xs">Trust 1-5</Label><Input className="h-8 text-sm" type="number" min={1} max={5} value={newCust.trust} onChange={e => setNewCust({ ...newCust, trust: parseInt(e.target.value) || 3 })} /></div>
          <div className="col-span-2"><Label className="text-xs">Gov ID</Label><Input className="h-8 text-sm" value={newCust.gov_id} onChange={e => setNewCust({ ...newCust, gov_id: e.target.value })} /></div>
        </div>
        <p className="text-[10px] text-muted-foreground">Credit limit by trust: {formatETB(TRUST_LIMITS[newCust.trust] || 0)}</p>
        <Button onClick={createInline} disabled={creating} className="w-full h-9 gradient-primary text-primary-foreground text-xs">
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          Create & Use
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-center">
          <Users className="w-4 h-4 mx-auto text-primary mb-0.5" />
          <p className="text-xs font-medium text-foreground">Select Customer</p>
        </div>
        <button onClick={() => setMode('new')} className="p-2.5 rounded-lg bg-muted hover:bg-accent border border-border text-center transition-colors">
          <UserPlus className="w-4 h-4 mx-auto text-muted-foreground mb-0.5" />
          <p className="text-xs font-medium text-foreground">Add New</p>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <div className="max-h-40 overflow-y-auto space-y-1">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-4">No customers found</p>
        ) : (
          filtered.map(c => {
            const cl = TRUST_LIMITS[c.trust || 3];
            const isOver = (c.credit_balance || 0) + total > cl;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={cn(
                  'w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors',
                  selected?.id === c.id ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                )}
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 overflow-hidden">
                  {c.photo_url ? <img src={c.photo_url} className="w-full h-full object-cover rounded-full" /> : c.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.phone} · Trust {c.trust} · Limit {formatETB(cl)}</p>
                </div>
                {c.credit_balance > 0 && <span className={cn('text-[10px] font-medium', isOver ? 'text-destructive' : 'text-warning')}>{formatETB(c.credit_balance)}</span>}
                {selected?.id === c.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {selected && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Check className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">{selected.name}</span>
            <span className="text-muted-foreground">• Adding: {formatETB(total)}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Existing balance: {formatETB(selected.credit_balance || 0)} · After: <span className={overLimit ? 'text-destructive font-bold' : 'text-foreground font-medium'}>{formatETB(exposure)}</span> / {formatETB(limit)}
          </div>
          {overLimit && (
            <div className="flex items-center gap-1.5 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1.5">
              <AlertTriangle className="w-3 h-3" /> Credit limit exceeded
            </div>
          )}
          <div>
            <Label className="text-xs">Due Date / የመክፈያ ቀን</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm mt-1" min={new Date().toISOString().split('T')[0]} />
          </div>
          <Button onClick={handleConfirm} className="w-full gradient-primary text-primary-foreground text-xs h-9" disabled={!dueDate || overLimit}>
            Confirm Credit Sale / የብድር ሽያጭ ያረጋግጡ
          </Button>
        </div>
      )}
    </div>
  );
}
