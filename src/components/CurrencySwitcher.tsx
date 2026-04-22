import { useState } from 'react';
import { Check, ChevronDown, ArrowLeftRight } from 'lucide-react';
import { useCurrency, CURRENCIES, getCurrencyMeta } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import CurrencyConverterDialog from './CurrencyConverterDialog';

export default function CurrencySwitcher() {
  const { currency, setCurrency, ratesToEtb } = useCurrency();
  const [open, setOpen] = useState(false);
  const [converterOpen, setConverterOpen] = useState(false);
  const meta = getCurrencyMeta(currency);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-colors"
          title="Change display currency"
        >
          <span className="text-base leading-none">{meta.flag}</span>
          <span className="font-semibold">{meta.code}</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-10 z-50 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Display Currency</p>
                  <p className="text-[10px] text-muted-foreground font-ethiopic">የማሳያ ምንዛሬ</p>
                </div>
                <button
                  onClick={() => { setOpen(false); setConverterOpen(true); }}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ArrowLeftRight className="w-3 h-3" /> Converter
                </button>
              </div>
              <ScrollArea className="max-h-[320px]">
                <div className="py-1">
                  {CURRENCIES.map(c => {
                    const isActive = c.code === currency;
                    const hasRate = c.code === 'ETB' || ratesToEtb[c.code];
                    return (
                      <button
                        key={c.code}
                        onClick={() => { setCurrency(c.code); setOpen(false); }}
                        disabled={!hasRate}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 transition-colors',
                          isActive && 'bg-primary/5',
                          !hasRate && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        <span className="text-lg">{c.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{c.code}</span>
                            <span className="text-[11px] text-muted-foreground truncate">{c.name}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-ethiopic">{c.nameAm}</p>
                        </div>
                        {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                        {!hasRate && !isActive && (
                          <span className="text-[9px] text-muted-foreground">no rate</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="px-4 py-2 bg-muted/30 border-t border-border">
                <p className="text-[10px] text-muted-foreground text-center">
                  Prices auto-convert from ETB live rates
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <CurrencyConverterDialog open={converterOpen} onOpenChange={setConverterOpen} />
    </>
  );
}
