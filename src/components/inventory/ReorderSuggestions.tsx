import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, RefreshCw, Sparkles, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportCSV, exportXLSX } from '@/lib/exporters';

interface Suggestion {
  product_id: string; name: string; unit: string;
  stock: number; min_stock: number; reorder_point: number;
  sold_30d: number; daily_velocity: number; stockout_in_days: number | null;
  suggested_qty: number; est_cost: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

const URG: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-warning/15 text-warning',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

export default function ReorderSuggestions() {
  const { toast } = useToast();
  const [data, setData] = useState<{ suggestions: Suggestion[]; ai_summary: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke('reorder-ai-suggest', { body: {} });
    setLoading(false);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    setData(res);
  };
  useEffect(() => { run(); }, []);

  const exp = (kind: 'csv' | 'xlsx') => {
    const rows = data?.suggestions || [];
    if (!rows.length) { toast({ title: 'Nothing to export' }); return; }
    const filename = `reorder-suggestions-${new Date().toISOString().slice(0,10)}`;
    kind === 'csv' ? exportCSV(rows, filename) : exportXLSX(rows, filename, 'Reorder');
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI Reorder Suggestions</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Velocity-based reorder qty (lead 7d + safety 7d) with AI commentary.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exp('csv')} disabled={!data}><Download className="w-3.5 h-3.5 mr-1" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exp('xlsx')} disabled={!data}><Download className="w-3.5 h-3.5 mr-1" /> XLSX</Button>
          <Button size="sm" onClick={run} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Recompute
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.ai_summary && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs whitespace-pre-wrap">
            <div className="font-semibold flex items-center gap-1 mb-1"><Sparkles className="w-3 h-3" /> AI insights</div>
            {data.ai_summary}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Urgency</TableHead><TableHead>Product</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Sold 30d</TableHead><TableHead className="text-right">Days left</TableHead>
              <TableHead className="text-right">Suggest qty</TableHead><TableHead className="text-right">Est. cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data?.suggestions?.length && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No reorder suggestions.</TableCell></TableRow>}
            {data?.suggestions?.map(s => (
              <TableRow key={s.product_id}>
                <TableCell><Badge className={URG[s.urgency]}>{s.urgency}</Badge></TableCell>
                <TableCell className="font-medium">{s.name} <span className="text-xs text-muted-foreground">/ {s.unit}</span></TableCell>
                <TableCell className="text-right">{s.stock}</TableCell>
                <TableCell className="text-right text-muted-foreground">{s.min_stock}</TableCell>
                <TableCell className="text-right">{s.sold_30d}</TableCell>
                <TableCell className="text-right">{s.stockout_in_days ?? '—'}</TableCell>
                <TableCell className="text-right font-bold">{s.suggested_qty}</TableCell>
                <TableCell className="text-right font-mono">ETB {s.est_cost.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
