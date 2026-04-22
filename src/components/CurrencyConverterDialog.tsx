import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCurrency, CURRENCIES, getCurrencyMeta } from '@/contexts/CurrencyContext';
import { ArrowDownUp, RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function CurrencyConverterDialog({ open, onOpenChange }: Props) {
  const { ratesToEtb, convert, refreshRates, loading, lastUpdated, currency } = useCurrency();
  const [amount, setAmount] = useState<string>('1');
  const [from, setFrom] = useState<string>(currency || 'USD');
  const [to, setTo] = useState<string>('ETB');

  useEffect(() => {
    if (open) {
      setFrom(currency === 'ETB' ? 'USD' : currency);
      setTo(currency === 'ETB' ? 'USD' : 'ETB');
    }
  }, [open, currency]);

  const numAmount = parseFloat(amount) || 0;
  const result = useMemo(() => convert(numAmount, from, to), [numAmount, from, to, convert]);

  const swap = () => { setFrom(to); setTo(from); };

  const fromMeta = getCurrencyMeta(from);
  const toMeta = getCurrencyMeta(to);
  const noDecimalsTo = ['JPY', 'LBP', 'DJF', 'SOS', 'SDG', 'ERN'].includes(to);

  const availableCurrencies = CURRENCIES.filter(c => c.code === 'ETB' || ratesToEtb[c.code]);

  // direct rate display
  const oneFromInTo = convert(1, from, to);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Currency Converter
            <span className="text-xs font-normal text-muted-foreground font-ethiopic ml-1">የምንዛሬ መቀየሪያ</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount + From */}
          <div className="space-y-2">
            <Label className="text-xs">From / ከ</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 text-lg font-semibold"
                min="0"
                step="0.01"
              />
              <select
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="px-3 rounded-md border border-input bg-background text-sm font-medium min-w-[110px]"
              >
                {availableCurrencies.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Swap button */}
          <div className="flex justify-center">
            <Button variant="outline" size="icon" onClick={swap} className="rounded-full h-9 w-9">
              <ArrowDownUp className="w-4 h-4" />
            </Button>
          </div>

          {/* To */}
          <div className="space-y-2">
            <Label className="text-xs">To / ወደ</Label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 rounded-md border border-input bg-muted/40 text-lg font-bold text-primary tabular-nums">
                {result.toLocaleString('en-US', {
                  minimumFractionDigits: noDecimalsTo ? 0 : 2,
                  maximumFractionDigits: noDecimalsTo ? 0 : 4,
                })}
              </div>
              <select
                value={to}
                onChange={e => setTo(e.target.value)}
                className="px-3 rounded-md border border-input bg-background text-sm font-medium min-w-[110px]"
              >
                {availableCurrencies.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rate */}
          <div className="bg-muted/40 rounded-lg px-4 py-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Exchange Rate</p>
            <p className="text-sm font-semibold text-foreground mt-1">
              1 {fromMeta.code} = {oneFromInTo.toLocaleString('en-US', { maximumFractionDigits: 6 })} {toMeta.code}
            </p>
            {lastUpdated && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Updated: {new Date(lastUpdated).toLocaleString()}
              </p>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshRates}
            disabled={loading}
            className="w-full gap-2"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Refreshing rates...' : 'Refresh live rates'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
