import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Journal = {
  id: string;
  entry_code: string;
  entry_date: string;
  description: string;
  reference: string | null;
  total_debit: number;
  created_at?: string;
};

const PREFIX_BADGE: Record<string, { label: string; className: string }> = {
  'JE-SALE': { label: 'POS → Finance', className: 'bg-success/10 text-success border-success/20' },
  'JE-GRN':  { label: 'Procurement → Inventory + AP', className: 'bg-info/10 text-info border-info/20' },
  'JE-PAY':  { label: 'Payroll → Finance', className: 'bg-primary/10 text-primary border-primary/20' },
  'JE-CR':   { label: 'Credit → Cash + AR', className: 'bg-warning/10 text-warning border-warning/20' },
};

function badgeFor(code: string) {
  for (const k of Object.keys(PREFIX_BADGE)) {
    if (code.startsWith(k)) return PREFIX_BADGE[k];
  }
  return { label: 'Manual', className: 'bg-muted text-muted-foreground' };
}

const fmt = (n: number) => `ETB ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function IntegrationActivityFeed() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('journal_entries')
        .select('id, entry_code, entry_date, description, reference, total_debit')
        .order('entry_date', { ascending: false })
        .limit(8);
      setJournals((data as Journal[]) || []);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('integration-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'journal_entries' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Card className="bg-card stat-card-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Cross-Module Activity
          <span className="text-xs font-normal text-muted-foreground ml-2">Live integration feed</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : journals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No integrated transactions yet.<br />
            <span className="text-xs">Make a POS sale, receive goods, or approve payroll to see flows here.</span>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {journals.map(j => {
              const b = badgeFor(j.entry_code);
              return (
                <div key={j.id} className="px-6 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] font-medium', b.className)}>
                        <ArrowRight className="w-2.5 h-2.5 mr-1" />{b.label}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">{j.entry_code}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mt-0.5">{j.description}</p>
                    <p className="text-[10px] text-muted-foreground">{j.entry_date}{j.reference ? ` • ${j.reference}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">{fmt(Number(j.total_debit))}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
