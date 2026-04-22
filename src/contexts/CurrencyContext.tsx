import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CurrencyMeta {
  code: string;
  symbol: string;
  flag: string;
  name: string;
  nameAm: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'ETB', symbol: 'ETB', flag: '🇪🇹', name: 'Ethiopian Birr', nameAm: 'የኢትዮጵያ ብር' },
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'US Dollar', nameAm: 'የአሜሪካ ዶላር' },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'Euro', nameAm: 'ዩሮ' },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'British Pound', nameAm: 'የብሪታኒያ ፓውንድ' },
  { code: 'KES', symbol: 'KSh', flag: '🇰🇪', name: 'Kenyan Shilling', nameAm: 'የኬንያ ሺሊንግ' },
  { code: 'CNY', symbol: '¥', flag: '🇨🇳', name: 'Chinese Yuan', nameAm: 'የቻይና ዩዋን' },
  { code: 'ERN', symbol: 'Nfk', flag: '🇪🇷', name: 'Eritrean Nakfa', nameAm: 'የኤርትራ ናቅፋ' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪', name: 'UAE Dirham', nameAm: 'የዱባይ ዲርሃም' },
  { code: 'SAR', symbol: '﷼', flag: '🇸🇦', name: 'Saudi Riyal', nameAm: 'የሳዑዲ ሪያል' },
  { code: 'LBP', symbol: 'ل.ل', flag: '🇱🇧', name: 'Lebanese Pound', nameAm: 'የሊባኖስ ፓውንድ' },
  { code: 'JPY', symbol: '¥', flag: '🇯🇵', name: 'Japanese Yen', nameAm: 'የጃፓን ዬን' },
  { code: 'INR', symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee', nameAm: 'የህንድ ሩፒ' },
  { code: 'EGP', symbol: 'E£', flag: '🇪🇬', name: 'Egyptian Pound', nameAm: 'የግብጽ ፓውንድ' },
  { code: 'ZAR', symbol: 'R', flag: '🇿🇦', name: 'South African Rand', nameAm: 'የደቡብ አፍሪካ ራንድ' },
  { code: 'DJF', symbol: 'Fdj', flag: '🇩🇯', name: 'Djiboutian Franc', nameAm: 'የጅቡቲ ፍራንክ' },
  { code: 'SDG', symbol: 'ج.س', flag: '🇸🇩', name: 'Sudanese Pound', nameAm: 'የሱዳን ፓውንድ' },
  { code: 'SOS', symbol: 'Sh', flag: '🇸🇴', name: 'Somali Shilling', nameAm: 'የሶማሊ ሺሊንግ' },
];

export const getCurrencyMeta = (code: string): CurrencyMeta =>
  CURRENCIES.find(c => c.code === code) || CURRENCIES[0];

interface CurrencyContextValue {
  /** Currently selected display currency code */
  currency: string;
  setCurrency: (code: string) => void;
  /** rates[code] = how many ETB per 1 unit of `code` */
  ratesToEtb: Record<string, number>;
  /** Convert an ETB amount to the active display currency */
  convertFromEtb: (etbAmount: number, target?: string) => number;
  /** Convert any amount from one currency to another (via ETB) */
  convert: (amount: number, from: string, to: string) => number;
  /** Format an ETB-stored amount in the active display currency */
  formatMoney: (etbAmount: number, opts?: { currency?: string; showCode?: boolean }) => string;
  refreshRates: () => Promise<void>;
  loading: boolean;
  lastUpdated: string | null;
}

const STORAGE_KEY = 'gebeya_display_currency';
const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'ETB';
    return localStorage.getItem(STORAGE_KEY) || 'ETB';
  });
  const [ratesToEtb, setRatesToEtb] = useState<Record<string, number>>({ ETB: 1 });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const setCurrency = (code: string) => {
    setCurrencyState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  };

  const loadRates = useCallback(async () => {
    const { data } = await supabase
      .from('exchange_rates')
      .select('base_currency, rate, fetched_at')
      .eq('target_currency', 'ETB')
      .order('fetched_at', { ascending: false });
    if (data && data.length > 0) {
      const seen = new Set<string>();
      const map: Record<string, number> = { ETB: 1 };
      let latest: string | null = null;
      for (const r of data) {
        if (!seen.has(r.base_currency)) {
          seen.add(r.base_currency);
          map[r.base_currency] = Number(r.rate);
          if (!latest) latest = r.fetched_at;
        }
      }
      setRatesToEtb(map);
      setLastUpdated(latest);
    }
  }, []);

  const refreshRates = useCallback(async () => {
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
      if (res.ok) await loadRates();
    } catch { /* silent */ }
    setLoading(false);
  }, [loadRates]);

  useEffect(() => { loadRates(); }, [loadRates]);

  const convertFromEtb = useCallback((etbAmount: number, target?: string): number => {
    const t = target || currency;
    if (t === 'ETB') return etbAmount;
    const rate = ratesToEtb[t];
    if (!rate || rate === 0) return etbAmount; // fallback: show as ETB number
    return etbAmount / rate;
  }, [currency, ratesToEtb]);

  const convert = useCallback((amount: number, from: string, to: string): number => {
    if (from === to) return amount;
    const fromRate = from === 'ETB' ? 1 : ratesToEtb[from];
    const toRate = to === 'ETB' ? 1 : ratesToEtb[to];
    if (!fromRate || !toRate) return amount;
    const etb = amount * fromRate;
    return etb / toRate;
  }, [ratesToEtb]);

  const formatMoney = useCallback((etbAmount: number, opts?: { currency?: string; showCode?: boolean }): string => {
    const target = opts?.currency || currency;
    const meta = getCurrencyMeta(target);
    const value = convertFromEtb(etbAmount, target);
    // For currencies typically without decimals (JPY, LBP, DJF, SOS, SDG, ERN), show 0 decimals
    const noDecimals = ['JPY', 'LBP', 'DJF', 'SOS', 'SDG', 'ERN'].includes(target);
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    });
    if (opts?.showCode || target === 'ETB') return `${target} ${formatted}`;
    return `${meta.symbol}${formatted}`;
  }, [currency, convertFromEtb]);

  return (
    <CurrencyContext.Provider value={{
      currency, setCurrency, ratesToEtb,
      convertFromEtb, convert, formatMoney,
      refreshRates, loading, lastUpdated,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
