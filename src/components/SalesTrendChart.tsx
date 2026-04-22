import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { formatETB } from '@/lib/ethiopian';

interface Sale {
  id: string;
  total: number;
  vat: number;
  payment_method: string;
  created_at: string;
}

interface SalesTrendChartProps {
  sales: Sale[];
  saleCostMap: Map<string, number>;
  dateFrom: Date;
  dateTo: Date;
}

export default function SalesTrendChart({ sales, saleCostMap, dateFrom, dateTo }: SalesTrendChartProps) {
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { date: string; revenue: number; cost: number; profit: number; cash: number; telebirr: number; cbe_birr: number; credit: number; bank: number; total: number }>();

    sales.forEach(s => {
      const day = s.created_at.split('T')[0];
      if (!dailyMap.has(day)) {
        dailyMap.set(day, { date: day, revenue: 0, cost: 0, profit: 0, cash: 0, telebirr: 0, cbe_birr: 0, credit: 0, bank: 0, total: 0 });
      }
      const d = dailyMap.get(day)!;
      const amount = Number(s.total);
      const vat = Number(s.vat);
      const cost = saleCostMap.get(s.id) || 0;
      d.total += amount;
      d.revenue += amount - vat;
      d.cost += cost;
      d.profit += (amount - vat - cost);
      switch (s.payment_method) {
        case 'cash': d.cash += amount; break;
        case 'telebirr': d.telebirr += amount; break;
        case 'cbe_birr': d.cbe_birr += amount; break;
        case 'credit': d.credit += amount; break;
        case 'bank_transfer': d.bank += amount; break;
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales, saleCostMap]);

  if (chartData.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }} className="flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span className="font-medium">{formatETB(entry.value)}</span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Sales & Profit Trend
          <span className="font-ethiopic text-xs text-muted-foreground ml-1">የሽያጭ እና ትርፍ አዝማሚያ</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} iconSize={10} />
              <Bar dataKey="cash" name="Cash" fill="hsl(var(--success))" radius={[2, 2, 0, 0]} stackId="a" />
              <Bar dataKey="telebirr" name="Telebirr" fill="hsl(var(--info))" stackId="a" />
              <Bar dataKey="cbe_birr" name="CBE Birr" fill="hsl(var(--primary))" stackId="a" />
              <Bar dataKey="credit" name="Credit" fill="hsl(var(--warning))" stackId="a" />
              <Bar dataKey="bank" name="Bank" fill="hsl(var(--earth))" radius={[2, 2, 0, 0]} stackId="a" />
              <Line type="monotone" dataKey="cost" name="Cost" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(130, 60%, 40%)" strokeWidth={2.5} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
