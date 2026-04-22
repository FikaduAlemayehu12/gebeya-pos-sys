import { useState, useEffect, useCallback } from 'react';
import { formatETB } from '@/lib/ethiopian';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Clock, AlertTriangle, CheckCircle, Phone, Loader2, DollarSign,
  Banknote, MessageCircle, Send, Eye, ChevronDown, ChevronUp, History,
  Package, Calendar, CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ReminderSettings from '@/components/ReminderSettings';
import CustomerProfileDialog from '@/components/CustomerProfileDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreditSale {
  id: string;
  sale_id: string;
  customer_id: string;
  total_amount: number;
  paid_amount: number;
  currency: string;
  due_date: string;
  status: string;
  created_at: string;
  customers: {
    name: string; name_am: string | null; phone: string; telegram_chat_id: string | null;
    photo_url: string | null; id_document_url: string | null; id_document_back_url: string | null;
    credit_balance: number | null; trust: number | null; email: string | null;
  } | null;
}

interface CreditPayment {
  id: string;
  credit_sale_id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
}

interface SaleItem {
  product_name: string;
  product_name_am: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

interface CustomerGroup {
  customer_id: string;
  customer: CreditSale['customers'];
  credits: CreditSale[];
  totalOwed: number;
  totalPaid: number;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-info/10 text-info border-info/20' },
  partial: { label: 'Partial', className: 'bg-warning/10 text-warning border-warning/20' },
  overdue: { label: 'Overdue', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  paid: { label: 'Paid', className: 'bg-success/10 text-success border-success/20' },
};

export default function CreditSales() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [credits, setCredits] = useState<CreditSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReminders, setShowReminders] = useState(false);
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [viewCustomerProfile, setViewCustomerProfile] = useState<any>(null);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [selectedCredit, setSelectedCredit] = useState<CreditSale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Collection state
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('cash');

  const handleNotifyCustomer = async (credit: CreditSale) => {
    if (!credit.customer_id) return;
    setNotifyingId(credit.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-individual-reminder', {
        body: { customer_id: credit.customer_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `📨 Notification sent to ${credit.customers?.name || 'customer'}!` });
    } catch (err: any) {
      toast({ title: 'Notification failed', description: err.message, variant: 'destructive' });
    }
    setNotifyingId(null);
  };

  const fetchCredits = useCallback(async () => {
    const { data } = await supabase
      .from('credit_sales')
      .select('*, customers(name, name_am, phone, telegram_chat_id, photo_url, id_document_url, id_document_back_url, credit_balance, trust, email)')
      .order('created_at', { ascending: false });
    setCredits((data as CreditSale[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCredits();
    const channel = supabase
      .channel('credit-sales-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_sales' }, () => fetchCredits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCredits]);

  const viewCreditDetails = async (credit: CreditSale) => {
    setSelectedCredit(credit);
    setLoadingDetails(true);

    const [itemsRes, paymentsRes] = await Promise.all([
      supabase.from('sale_items').select('product_name, product_name_am, quantity, unit_price, total, created_at').eq('sale_id', credit.sale_id),
      supabase.from('credit_payments').select('*').eq('credit_sale_id', credit.id).order('created_at', { ascending: false }),
    ]);

    setSaleItems((itemsRes.data as SaleItem[]) || []);
    setCreditPayments((paymentsRes.data as CreditPayment[]) || []);
    setLoadingDetails(false);
  };

  const handleCollect = async (credit: CreditSale) => {
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    const remaining = credit.total_amount - credit.paid_amount;
    if (amount > remaining) {
      toast({ title: 'Amount exceeds remaining balance', variant: 'destructive' });
      return;
    }

    const newPaid = credit.paid_amount + amount;
    const newStatus = newPaid >= credit.total_amount ? 'paid' : 'partial';

    // Record payment in credit_payments
    const { error: payErr } = await supabase.from('credit_payments').insert({
      credit_sale_id: credit.id,
      amount,
      payment_method: collectMethod,
      collected_by: (await supabase.auth.getUser()).data.user?.id,
    });

    if (payErr) {
      toast({ title: 'Error recording payment', description: payErr.message, variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('credit_sales').update({
      paid_amount: newPaid,
      status: newStatus,
    }).eq('id', credit.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    if (credit.customer_id) {
      const { data: custData } = await supabase.from('customers').select('credit_balance').eq('id', credit.customer_id).single();
      if (custData) {
        await supabase.from('customers').update({
          credit_balance: Math.max(0, Number(custData.credit_balance || 0) - amount),
        }).eq('id', credit.customer_id);
      }
    }

    toast({ title: `✅ ${formatETB(amount)} collected!` });
    setCollectingId(null);
    setCollectAmount('');
    setCollectMethod('cash');
    fetchCredits();
  };

  // Group credits by customer
  const groupedByCustomer: CustomerGroup[] = (() => {
    const map = new Map<string, CustomerGroup>();
    credits.forEach(c => {
      if (!map.has(c.customer_id)) {
        map.set(c.customer_id, {
          customer_id: c.customer_id,
          customer: c.customers,
          credits: [],
          totalOwed: 0,
          totalPaid: 0,
        });
      }
      const g = map.get(c.customer_id)!;
      g.credits.push(c);
      g.totalOwed += c.total_amount;
      g.totalPaid += c.paid_amount;
    });
    return Array.from(map.values());
  })();

  const totalOutstanding = credits.filter(c => c.status !== 'paid').reduce((s, c) => s + (c.total_amount - c.paid_amount), 0);
  const overdueCount = credits.filter(c => c.status === 'overdue').length;
  const activeCount = credits.filter(c => c.status !== 'paid').length;
  const todayCollected = credits.filter(c => {
    if (c.status !== 'paid') return false;
    const today = new Date().toISOString().split('T')[0];
    return c.created_at.startsWith(today);
  }).reduce((s, c) => s + c.total_amount, 0);

  const filteredGroups = groupedByCustomer.filter(g => {
    const name = g.customer?.name || '';
    const nameAm = g.customer?.name_am || '';
    return name.toLowerCase().includes(search.toLowerCase()) || nameAm.includes(search);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Sales</h1>
          <p className="text-sm text-muted-foreground font-ethiopic">የብድር ሽያጭ • Wedaj System</p>
        </div>
        <Button variant={showReminders ? 'default' : 'outline'} size="sm" className="gap-1.5 text-xs" onClick={() => setShowReminders(!showReminders)}>
          <MessageCircle className="w-3.5 h-3.5" />
          {showReminders ? 'Hide Reminders' : 'Reminder Settings'}
        </Button>
      </div>

      {showReminders && <ReminderSettings onSendReminders={fetchCredits} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-xl font-bold text-warning">{formatETB(totalOutstanding)}</p>
        </CardContent></Card>
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className="text-xl font-bold text-destructive">{overdueCount}</p>
        </CardContent></Card>
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Active Credits</p>
          <p className="text-xl font-bold text-foreground">{activeCount}</p>
        </CardContent></Card>
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Collected Today</p>
          <p className="text-xl font-bold text-success">{formatETB(todayCollected)}</p>
        </CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search credits... / ፈልግ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No credit sales yet</p>
            <p className="text-xs font-ethiopic">የብድር ሽያጭ የለም</p>
          </div>
        ) : (
          filteredGroups.map(group => {
            const isExpanded = expandedCustomer === group.customer_id;
            const totalRemaining = group.totalOwed - group.totalPaid;
            const activeCredits = group.credits.filter(c => c.status !== 'paid');

            return (
              <Card key={group.customer_id} className={cn('bg-card', activeCredits.some(c => c.status === 'overdue') && 'ring-1 ring-destructive/30')}>
                <CardContent className="p-4">
                  {/* Customer header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => group.customer && setViewCustomerProfile({
                          id: group.customer_id,
                          name: group.customer.name,
                          name_am: group.customer.name_am,
                          phone: group.customer.phone,
                          photo_url: group.customer.photo_url,
                          id_document_url: group.customer.id_document_url,
                          id_document_back_url: group.customer.id_document_back_url,
                          credit_balance: group.customer.credit_balance,
                          trust: group.customer.trust,
                          telegram_chat_id: group.customer.telegram_chat_id,
                        })}
                        className="shrink-0"
                      >
                        <Avatar className="w-10 h-10 border border-border hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer">
                          <AvatarImage src={group.customer?.photo_url || undefined} />
                          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                            {(group.customer?.name || '??').split(' ').slice(0, 2).map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{group.customer?.name || 'Unknown'}</p>
                        {group.customer?.name_am && (
                          <p className="text-[11px] font-ethiopic text-muted-foreground">{group.customer.name_am}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/20">
                            {group.credits.length} credit{group.credits.length > 1 ? 's' : ''}
                          </Badge>
                          {activeCredits.some(c => c.status === 'overdue') && (
                            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Overdue
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Total Remaining</p>
                        <p className={cn('text-base font-bold', totalRemaining > 0 ? 'text-warning' : 'text-success')}>
                          {formatETB(totalRemaining)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedCustomer(isExpanded ? null : group.customer_id)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Overall progress */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Total Paid: {formatETB(group.totalPaid)}</span>
                      <span>Total: {formatETB(group.totalOwed)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', group.totalPaid >= group.totalOwed ? 'bg-success' : 'gradient-gold')}
                        style={{ width: `${Math.min((group.totalPaid / group.totalOwed) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Expanded: individual credit records */}
                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-border pt-3">
                      {group.credits.map(credit => {
                        const remaining = credit.total_amount - credit.paid_amount;
                        const pctPaid = (credit.paid_amount / credit.total_amount) * 100;
                        const sc = statusConfig[credit.status] || statusConfig.active;
                        const dueDate = new Date(credit.due_date);
                        const now = new Date();
                        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

                        return (
                          <div key={credit.id} className="bg-muted/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={cn('text-[10px]', sc.className)}>{sc.label}</Badge>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(credit.created_at).toLocaleDateString()} {new Date(credit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[10px] text-muted-foreground">Due: {dueDate.toLocaleDateString()}</span>
                                {daysLeft < 0 && credit.status !== 'paid' && (
                                  <span className="text-[10px] text-destructive font-medium">{Math.abs(daysLeft)} days overdue</span>
                                )}
                                {daysLeft > 0 && daysLeft <= 7 && credit.status !== 'paid' && (
                                  <span className="text-[10px] text-warning font-medium">{daysLeft} days left</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className={cn('text-sm font-bold', remaining > 0 ? 'text-warning' : 'text-success')}>
                                  {formatETB(remaining)}
                                </span>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn('h-full rounded-full', pctPaid >= 100 ? 'bg-success' : 'gradient-gold')}
                                style={{ width: `${Math.min(pctPaid, 100)}%` }}
                              />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">Paid: {formatETB(credit.paid_amount)} / {formatETB(credit.total_amount)}</span>

                              {/* View details button */}
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => viewCreditDetails(credit)}>
                                <Eye className="w-3 h-3" /> Details
                              </Button>

                              {/* Notify */}
                              {remaining > 0 && (
                                <Button
                                  variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2"
                                  disabled={notifyingId === credit.id}
                                  onClick={() => handleNotifyCustomer(credit)}
                                >
                                  {notifyingId === credit.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3 text-info" />}
                                  Notify
                                </Button>
                              )}

                              {/* Collect payment */}
                              {remaining > 0 && (
                                collectingId === credit.id ? (
                                  <div className="flex gap-1 items-center">
                                    <Input
                                      type="number" placeholder="Amount"
                                      value={collectAmount} onChange={e => setCollectAmount(e.target.value)}
                                      className="h-6 w-20 text-[10px]"
                                    />
                                    <Select value={collectMethod} onValueChange={setCollectMethod}>
                                      <SelectTrigger className="h-6 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="cash">Cash</SelectItem>
                                        <SelectItem value="telebirr">Telebirr</SelectItem>
                                        <SelectItem value="cbe_birr">CBE</SelectItem>
                                        <SelectItem value="bank_transfer">Bank</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button size="sm" className="h-6 text-[10px] gradient-primary text-primary-foreground px-2" onClick={() => handleCollect(credit)}>
                                      <CheckCircle className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setCollectingId(null); setCollectAmount(''); }}>
                                      <AlertTriangle className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="sm" className="h-6 text-[10px] gradient-primary text-primary-foreground gap-1 px-2" onClick={() => setCollectingId(credit.id)}>
                                    <Banknote className="w-3 h-3" /> Collect
                                  </Button>
                                )
                              )}

                              {group.customer?.phone && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                                  <a href={`tel:${group.customer.phone}`}><Phone className="w-3 h-3" /></a>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Credit Detail Dialog */}
      <Dialog open={!!selectedCredit} onOpenChange={o => !o && setSelectedCredit(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" /> Credit Details / የብድር ዝርዝር
            </DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* Items purchased */}
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <Package className="w-3.5 h-3.5" /> Items Purchased / የተገዙ ዕቃዎች
                </h3>
                <div className="space-y-1.5">
                  {saleItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg p-2.5">
                      <div>
                        <p className="text-xs font-medium text-foreground">{item.product_name}</p>
                        {item.product_name_am && <p className="text-[10px] text-muted-foreground font-ethiopic">{item.product_name_am}</p>}
                        <p className="text-[10px] text-muted-foreground">
                          {item.quantity} × {formatETB(item.unit_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">{formatETB(item.total)}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Credit summary */}
              {selectedCredit && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-bold text-foreground">{formatETB(selectedCredit.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-bold text-success">{formatETB(selectedCredit.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-bold text-warning">{formatETB(selectedCredit.total_amount - selectedCredit.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Due Date / የመክፈያ ቀን</span>
                    <span className="font-medium text-foreground">{new Date(selectedCredit.due_date).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              {/* Payment history */}
              <div>
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                  <CreditCard className="w-3.5 h-3.5" /> Payment History / የክፍያ ታሪክ
                </h3>
                {creditPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No payments recorded yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {creditPayments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between bg-success/5 rounded-lg p-2.5">
                        <div>
                          <p className="text-xs font-medium text-success">{formatETB(payment.amount)}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{payment.payment_method.replace('_', ' ')}</p>
                          {payment.notes && <p className="text-[10px] text-muted-foreground">{payment.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CustomerProfileDialog customer={viewCustomerProfile} open={!!viewCustomerProfile} onOpenChange={o => !o && setViewCustomerProfile(null)} />
    </div>
  );
}
