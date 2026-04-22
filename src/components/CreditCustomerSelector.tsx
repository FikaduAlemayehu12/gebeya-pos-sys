import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, Users, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatETB } from '@/lib/ethiopian';

interface Customer {
  id: string;
  name: string;
  name_am: string | null;
  phone: string;
  trust: number;
  credit_balance: number;
  photo_url: string | null;
}

interface CreditCustomerSelectorProps {
  onSelectCustomer: (customer: Customer, dueDate: string) => void;
  onAddNewCustomer: () => void;
  total: number;
}

export default function CreditCustomerSelector({ onSelectCustomer, onAddNewCustomer, total }: CreditCustomerSelectorProps) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dueDate, setDueDate] = useState('');

  // Default due date: 30 days from now
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, name_am, phone, trust, credit_balance, photo_url')
        .order('name');
      setCustomers((data as Customer[]) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.name_am || '').includes(search) ||
    c.phone.includes(search)
  );

  const handleConfirm = () => {
    if (selectedCustomer && dueDate) {
      onSelectCustomer(selectedCustomer, dueDate);
    }
  };

  return (
    <div className="space-y-4">
      {/* Two options */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
          <Users className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xs font-medium text-foreground">Select Customer</p>
          <p className="text-[10px] text-muted-foreground font-ethiopic">ደንበኛ ይምረጡ</p>
        </div>
        <button
          onClick={onAddNewCustomer}
          className="p-3 rounded-lg bg-muted hover:bg-accent border border-border text-center transition-colors"
        >
          <UserPlus className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs font-medium text-foreground">Add New</p>
          <p className="text-[10px] text-muted-foreground font-ethiopic">አዲስ ደንበኛ</p>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Customer list */}
      <div className="max-h-40 overflow-y-auto space-y-1">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-4">No customers found</p>
        ) : (
          filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCustomer(c)}
              className={cn(
                'w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors',
                selectedCustomer?.id === c.id
                  ? 'bg-primary/10 ring-1 ring-primary/30'
                  : 'hover:bg-muted'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 overflow-hidden">
                {c.photo_url ? (
                  <img src={c.photo_url} className="w-full h-full object-cover rounded-full" />
                ) : (
                  c.name.split(' ').slice(0, 2).map(n => n[0]).join('')
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.phone}</p>
              </div>
              {c.credit_balance > 0 && (
                <span className="text-[10px] text-warning font-medium">{formatETB(c.credit_balance)}</span>
              )}
              {selectedCustomer?.id === c.id && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          ))
        )}
      </div>

      {/* Due date */}
      {selectedCustomer && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-foreground">
            <Check className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium">{selectedCustomer.name}</span>
            <span className="text-muted-foreground">• Credit: {formatETB(total)}</span>
          </div>
          <div>
            <Label className="text-xs">Due Date / የመክፈያ ቀን</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="h-9 text-sm mt-1"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <Button onClick={handleConfirm} className="w-full gradient-primary text-primary-foreground text-xs h-9" disabled={!dueDate}>
            Confirm Credit Sale / የብድር ሽያጭ ያረጋግጡ
          </Button>
        </div>
      )}
    </div>
  );
}
