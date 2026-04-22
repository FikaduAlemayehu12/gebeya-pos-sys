import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Currencies we track against ETB
const TARGET_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'KES', 'CNY', 'ERN', 'AED', 'SAR', 'LBP', 'JPY', 'INR', 'EGP', 'ZAR', 'DJF', 'SDG', 'SOS'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Try multiple free APIs for exchange rates
    let rates: Record<string, number> = {};
    let source = '';

    // Strategy 1: ExchangeRate-API (free tier, no key needed)
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/ETB');
      if (res.ok) {
        const data = await res.json();
        if (data.result === 'success' && data.rates) {
          // data.rates gives us 1 ETB = X foreign currency
          // We want 1 foreign = X ETB, so invert
          for (const cur of TARGET_CURRENCIES) {
            if (data.rates[cur]) {
              rates[cur] = 1 / data.rates[cur];
            }
          }
          source = 'ExchangeRate-API (open.er-api.com)';
        }
      }
    } catch { /* fallback */ }

    // Strategy 2: Fallback to frankfurter.app (ECB data, limited currencies)
    if (Object.keys(rates).length === 0) {
      try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD');
        if (res.ok) {
          const data = await res.json();
          // Frankfurter doesn't have ETB directly, use approximate NBE rate
          // This is a fallback - we'll use a known approximate USD/ETB rate
          const usdToEtb = 130; // approximate fallback
          rates['USD'] = usdToEtb;
          if (data.rates) {
            for (const cur of TARGET_CURRENCIES) {
              if (cur === 'USD') continue;
              if (data.rates[cur]) {
                // 1 foreign = (usdToEtb / foreignPerUsd) ETB
                rates[cur] = usdToEtb / data.rates[cur];
              }
            }
          }
          source = 'Frankfurter (ECB) + estimated ETB';
        }
      } catch { /* fallback */ }
    }

    if (Object.keys(rates).length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to fetch rates from all sources' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert all rates into the exchange_rates table
    const now = new Date().toISOString();
    const rows = Object.entries(rates).map(([currency, rate]) => ({
      base_currency: currency,
      target_currency: 'ETB',
      rate: Number(rate.toFixed(4)),
      fetched_at: now,
      source,
    }));

    const { error } = await supabase.from('exchange_rates').insert(rows);
    if (error) {
      console.error('DB insert error:', error);
    }

    return new Response(JSON.stringify({ success: true, rates, source, updated: now }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Exchange rate fetch error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
