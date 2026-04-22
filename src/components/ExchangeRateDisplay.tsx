import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, TrendingUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExchangeRate {
  base_currency: string;
  target_currency: string;
  rate: number;
  fetched_at: string;
  source: string;
}

const CURRENCY_META: Record<string, { flag: string; name: string; nameAm: string }> = {
  USD: { flag: '🇺🇸', name: 'US Dollar', nameAm: 'የአሜሪካ ዶላር' },
  EUR: { flag: '🇪🇺', name: 'Euro', nameAm: 'ዩሮ' },
  GBP: { flag: '🇬🇧', name: 'British Pound', nameAm: 'የብሪታኒያ ፓውንድ' },
  KES: { flag: '🇰🇪', name: 'Kenyan Shilling', nameAm: 'የኬንያ ሺሊንግ' },
  CNY: { flag: '🇨🇳', name: 'Chinese Yuan', nameAm: 'የቻይና ዩዋን' },
  ERN: { flag: '🇪🇷', name: 'Eritrean Nakfa', nameAm: 'የኤርትራ ናቅፋ' },
  AED: { flag: '🇦🇪', name: 'UAE Dirham (Dubai)', nameAm: 'የዱባይ ዲርሃም' },
  SAR: { flag: '🇸🇦', name: 'Saudi Riyal', nameAm: 'የሳዑዲ ሪያል' },
  LBP: { flag: '🇱🇧', name: 'Lebanese Pound (Beirut)', nameAm: 'የሊባኖስ ፓውንድ' },
  JPY: { flag: '🇯🇵', name: 'Japanese Yen', nameAm: 'የጃፓን ዬን' },
  INR: { flag: '🇮🇳', name: 'Indian Rupee', nameAm: 'የህንድ ሩፒ' },
  EGP: { flag: '🇪🇬', name: 'Egyptian Pound', nameAm: 'የግብጽ ፓውንድ' },
  ZAR: { flag: '🇿🇦', name: 'South African Rand', nameAm: 'የደቡብ አፍሪካ ራንድ' },
  DJF: { flag: '🇩🇯', name: 'Djiboutian Franc', nameAm: 'የጅቡቲ ፍራንክ' },
  SDG: { flag: '🇸🇩', name: 'Sudanese Pound', nameAm: 'የሱዳን ፓውንድ' },
  SOS: { flag: '🇸🇴', name: 'Somali Shilling', nameAm: 'የሶማሊ ሺሊንግ' },
};

export default function ExchangeRateDisplay() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [primaryRate, setPrimaryRate] = useState<ExchangeRate | null>(null);

  const fetchRates = async () => {
    // Get latest rate per currency pair
    const { data } = await supabase
      .from('exchange_rates')
      .select('base_currency, target_currency, rate, fetched_at, source')
      .eq('target_currency', 'ETB')
      .order('fetched_at', { ascending: false });

    if (data && data.length > 0) {
      // Deduplicate: keep only the latest per base_currency
      const seen = new Set<string>();
      const unique: ExchangeRate[] = [];
      for (const r of data) {
        if (!seen.has(r.base_currency)) {
          seen.add(r.base_currency);
          unique.push(r as ExchangeRate);
        }
      }
      setRates(unique);
      setPrimaryRate(unique.find(r => r.base_currency === 'USD') || unique[0]);
    }
  };

  const refreshRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-exchange-rate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (res.ok) await fetchRates();
    } catch { /* silently fail */ }
    setLoading(false);
  };

  useEffect(() => { fetchRates(); }, []);

  const updatedTime = primaryRate
    ? new Date(primaryRate.fetched_at).toLocaleString()
    : null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
      >
        <ArrowUpDown className="w-3 h-3" />
        <span className="font-ethiopic">ETB</span>
        {primaryRate && <span className="text-foreground">{Number(primaryRate.rate).toFixed(2)}</span>}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Exchange Rates / የምንዛሬ ተመን</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Source: {primaryRate?.source || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={refreshRates}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-muted transition-colors"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                  {loading ? 'Updating...' : 'Refresh'}
                </button>
              </div>
              {updatedTime && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Last updated: {updatedTime}
                </p>
              )}
            </div>

            {/* Rates List */}
            <ScrollArea className="max-h-[360px]">
              <div className="divide-y divide-border">
                {rates.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">No rates available</p>
                    <button
                      onClick={refreshRates}
                      disabled={loading}
                      className="text-xs text-primary hover:underline"
                    >
                      Fetch live rates now
                    </button>
                  </div>
                ) : (
                  rates.map((r) => {
                    const meta = CURRENCY_META[r.base_currency];
                    return (
                      <div
                        key={r.base_currency}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-lg">{meta?.flag || '🏳️'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{r.base_currency}</span>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {meta?.name || r.base_currency}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-ethiopic">{meta?.nameAm || ''}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {Number(r.rate).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">ETB</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="px-4 py-2 bg-muted/30 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                1 Foreign Currency = X ETB • Data from open exchange rate APIs
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
