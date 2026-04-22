// ERP Copilot — streaming AI chat with live data context
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { messages = [] } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Pull live ERP context from Lovable Cloud
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [salesToday, salesMonth, lowStock, pendingPayments, openCredits, payrollRuns, branches, suppliers, employees] = await Promise.all([
      supabase.from("sales").select("total").gte("created_at", today.toISOString()),
      supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()),
      supabase.from("products").select("name, stock, min_stock").lt("stock", 10).limit(20),
      supabase.from("payment_requests").select("payee, amount, currency, urgency, status").eq("status", "pending").limit(20),
      supabase.from("credit_sales").select("total_amount, paid_amount, status").eq("status", "active"),
      supabase.from("payroll_runs").select("run_code, status, total_net, period_month, period_year").order("created_at", { ascending: false }).limit(5),
      supabase.from("branches").select("name, code, is_active"),
      supabase.from("suppliers").select("name, rating, total_spend").order("total_spend", { ascending: false }).limit(5),
      supabase.from("employees").select("status").eq("status", "active"),
    ]);

    const sum = (rows: any[] | null, key: string) => (rows || []).reduce((s, r) => s + Number(r[key] ?? 0), 0);
    const ctx = {
      salesToday: sum(salesToday.data, "total"),
      salesTodayCount: salesToday.data?.length ?? 0,
      salesMonth: sum(salesMonth.data, "total"),
      lowStockItems: lowStock.data ?? [],
      pendingPayments: pendingPayments.data ?? [],
      openCreditTotal: sum(openCredits.data, "total_amount") - sum(openCredits.data, "paid_amount"),
      openCreditCount: openCredits.data?.length ?? 0,
      recentPayrollRuns: payrollRuns.data ?? [],
      branches: branches.data ?? [],
      topSuppliers: suppliers.data ?? [],
      activeEmployees: employees.data?.length ?? 0,
    };

    const system = `You are ERP Copilot, a helpful AI assistant for an Ethiopian enterprise (Bizflow + Abyssinia ERP).
You have live context from the company's Lovable Cloud database.

LIVE DATA SNAPSHOT (use this to answer factually; amounts are in ETB unless stated):
${JSON.stringify(ctx, null, 2)}

Guidelines:
- Be concise, friendly, and use markdown (lists, bold).
- When user asks about totals, sales, stock, payroll, suppliers, or payments, refer to the snapshot above.
- If something is not in the snapshot, say so and suggest where to find it (e.g. "Open the Inventory page").
- Use ETB for currency unless the user specifies another.
- Keep answers under 8 lines unless asked for detail.`;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: system }, ...messages],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await upstream.text();
      console.error("AI gateway error", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(upstream.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("erp-chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
