import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const receiptId = url.searchParams.get('receipt_id');

  if (!receiptId) {
    return new Response(JSON.stringify({ error: 'receipt_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('*')
    .eq('receipt_id', receiptId)
    .single();

  if (saleErr || !sale) {
    return new Response(JSON.stringify({ error: 'Receipt not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const [itemsRes, creditRes, cashierRes, customerRes] = await Promise.all([
    supabase.from('sale_items').select('*').eq('sale_id', sale.id),
    supabase.from('credit_sales').select('*, customers(name, phone, email)').eq('sale_id', sale.id).maybeSingle(),
    sale.cashier_id
      ? supabase.from('profiles').select('full_name').eq('user_id', sale.cashier_id).single()
      : Promise.resolve({ data: null }),
    sale.customer_id
      ? supabase.from('customers').select('name, phone, email').eq('id', sale.customer_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return new Response(JSON.stringify({
    sale,
    items: itemsRes.data || [],
    creditSale: creditRes.data,
    cashier: cashierRes.data,
    customer: customerRes.data,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
