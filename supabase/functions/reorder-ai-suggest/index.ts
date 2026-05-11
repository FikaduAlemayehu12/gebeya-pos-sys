// AI-powered reorder suggestions: velocity + lead time + Lovable AI summary.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const auth = req.headers.get('Authorization') || '';
    const supabase = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });

    const { branch_id } = await req.json().catch(() => ({}));

    // Pull active products with low/at-risk stock
    let q = supabase.from('products')
      .select('id,name,stock,min_stock,reorder_point,unit,price,cost,branch_id')
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .limit(100);
    if (branch_id) q = q.eq('branch_id', branch_id);
    const { data: products, error: pErr } = await q;
    if (pErr) throw pErr;

    const ids = (products || []).map(p => p.id);
    if (ids.length === 0) return jsonOk({ suggestions: [] });

    // 30-day velocity from sale_items joined on sales.created_at
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: sales } = await supabase
      .from('sale_items')
      .select('product_id, quantity, sales!inner(created_at,status)')
      .in('product_id', ids)
      .gte('sales.created_at', since);

    const velocity: Record<string, number> = {};
    for (const r of (sales as any[]) || []) {
      if (r.sales?.status === 'void') continue;
      velocity[r.product_id] = (velocity[r.product_id] || 0) + Number(r.quantity || 0);
    }

    const suggestions = (products || []).map((p) => {
      const sold30 = velocity[p.id] || 0;
      const dailyVel = sold30 / 30;
      const leadDays = 7;
      const safetyDays = 7;
      const targetCover = leadDays + safetyDays;
      const targetStock = Math.max(p.min_stock || 0, Math.ceil(dailyVel * targetCover));
      const suggestedQty = Math.max(0, targetStock - (p.stock || 0));
      const stockoutDays = dailyVel > 0 ? Math.floor((p.stock || 0) / dailyVel) : null;
      const urgency =
        (p.stock || 0) <= 0 ? 'critical'
        : (p.stock || 0) <= (p.min_stock || 0) ? 'high'
        : stockoutDays !== null && stockoutDays <= leadDays ? 'medium'
        : 'low';
      return {
        product_id: p.id, name: p.name, unit: p.unit,
        stock: p.stock, min_stock: p.min_stock, reorder_point: p.reorder_point,
        sold_30d: sold30, daily_velocity: Number(dailyVel.toFixed(2)),
        stockout_in_days: stockoutDays, suggested_qty: suggestedQty,
        est_cost: Number(((p.cost || 0) * suggestedQty).toFixed(2)),
        urgency,
      };
    }).filter(s => s.suggested_qty > 0)
      .sort((a, b) => {
        const w: any = { critical: 0, high: 1, medium: 2, low: 3 };
        return w[a.urgency] - w[b.urgency];
      })
      .slice(0, 30);

    // AI summary
    let aiSummary = '';
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (apiKey && suggestions.length) {
      try {
        const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: 'You are a procurement analyst. Be terse: 3-5 bullet recommendations citing top-priority products by name and qty. No fluff.' },
              { role: 'user', content: `Reorder candidates (top 15): ${JSON.stringify(suggestions.slice(0, 15))}. Suggest priorities, grouping, and any risks.` },
            ],
          }),
        });
        if (resp.status === 429) aiSummary = '⚠️ AI rate limit — try again shortly.';
        else if (resp.status === 402) aiSummary = '⚠️ AI credits exhausted — top up workspace.';
        else {
          const j = await resp.json();
          aiSummary = j.choices?.[0]?.message?.content || '';
        }
      } catch (e) {
        aiSummary = `AI summary unavailable: ${e instanceof Error ? e.message : 'error'}`;
      }
    }

    return jsonOk({ suggestions, ai_summary: aiSummary, generated_at: new Date().toISOString() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function jsonOk(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
