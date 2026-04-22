import { useState, useEffect, useCallback } from 'react';
import { formatETB, formatPhone } from '@/lib/ethiopian';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Phone, MapPin, Star, Loader2, Users, Trash2, Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import CustomerFormDialog from '@/components/CustomerFormDialog';
import CustomerProfileDialog from '@/components/CustomerProfileDialog';

interface Customer {
  id: string;
  name: string;
  name_am: string;
  phone: string;
  alt_phone: string;
  email: string;
  city: string;
  sub_city: string;
  woreda: string;
  kebele: string;
  trust: number;
  total_purchases: number;
  credit_balance: number;
  guarantor_name: string;
  guarantor_phone: string;
  gov_id: string;
  notes: string;
  photo_url: string;
  id_document_url: string;
  id_document_back_url: string;
}

// CustomerDetailDialog is now in shared component CustomerProfileDialog

export default function Customers() {
  const { toast } = useToast();
  const { hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete customer "${name}"?`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Customer deleted' }); fetchCustomers(); }
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.name_am || '').includes(search) ||
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">ደንበኞች</p>
        </div>
        <CustomerFormDialog onSuccess={fetchCustomers} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone... / ፈልግ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No customers found. Add your first customer!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(customer => (
            <Card key={customer.id} className="bg-card hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <Avatar className="w-11 h-11 shrink-0 cursor-pointer" onClick={() => setViewCustomer(customer)}>
                    {customer.photo_url ? (
                      <AvatarImage src={customer.photo_url} alt={customer.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="gradient-coffee text-sm font-bold text-coffee-foreground">
                      {customer.name.split(' ').slice(0, 2).map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{customer.name}</p>
                    {customer.name_am && <p className="text-[11px] font-ethiopic text-muted-foreground">{customer.name_am}</p>}
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={cn('w-3 h-3', i < customer.trust ? 'text-gold fill-gold' : 'text-muted')} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="text-xs p-1" onClick={() => setViewCustomer(customer)}>
                      <Eye className="w-3 h-3" />
                    </Button>
                    <CustomerFormDialog customer={customer} onSuccess={fetchCustomers} />
                    {hasRole('admin') && (
                      <Button variant="ghost" size="sm" className="text-destructive text-xs p-1" onClick={() => handleDelete(customer.id, customer.name)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{formatPhone(customer.phone)}</span>
                    {customer.alt_phone && <span className="text-muted">• {formatPhone(customer.alt_phone)}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{customer.city}{customer.sub_city ? `, ${customer.sub_city}` : ''}{customer.woreda ? ` • W${customer.woreda}` : ''}{customer.kebele ? `/K${customer.kebele}` : ''}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Purchases</p>
                    <p className="text-sm font-bold text-foreground">{formatETB(customer.total_purchases)}</p>
                  </div>
                  {customer.credit_balance > 0 ? (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Credit Balance</p>
                      <p className="text-sm font-bold text-warning">{formatETB(customer.credit_balance)}</p>
                    </div>
                  ) : (
                    <Badge className="bg-success/10 text-success border-success/20 text-[10px]">No Credit</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewCustomer && (
        <CustomerProfileDialog customer={viewCustomer} open={!!viewCustomer} onOpenChange={(o) => !o && setViewCustomer(null)} />
      )}
    </div>
  );
}
