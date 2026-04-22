// HR AI Assistant — uses Lovable AI Gateway with tool calling on live HR data
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an HR & Payroll Assistant for an Ethiopian business running Gebeya POS.
You answer questions about employees, attendance, leave, loans, payroll, and Ethiopian payroll rules.

Ethiopian payroll context (apply this when explaining or computing taxes):
- Income Tax (Amendment) Proclamation No. 1395/2025 (effective July 1, 2025) brackets:
  0–2,000: 0%, 2,001–4,000: 15%, 4,001–7,000: 20%, 7,001–10,000: 25%, 10,001–14,000: 30%, 14,001+: 35%
- Pension (Proclamation 1268/2022): 7% employee, 11% employer (on base salary)
- Transport allowance is tax-exempt up to 2,200 ETB/month

Use the provided tools to query LIVE database data. When the user asks about specific employees, attendance, leaves, loans, or payroll, ALWAYS call a tool first — do not guess. Be concise, accurate, and use ETB for currency.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_employees",
      description: "List employees, optionally filtered by status, branch, or name search.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "active | inactive | terminated" },
          branch_id: { type: "string" },
          search: { type: "string", description: "Search by name or employee code" },
          limit: { type: "number", default: 50 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_employee_details",
      description: "Get full details for a specific employee by ID or employee_code.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          employee_code: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_attendance_summary",
      description: "Get attendance records for a date range, optionally for a specific employee.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          date_from: { type: "string", description: "YYYY-MM-DD" },
          date_to: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["date_from", "date_to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leave_requests",
      description: "Get leave requests, optionally filtered by status or employee.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "pending | approved | rejected" },
          employee_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_loans",
      description: "Get employee loans, optionally filtered by employee or status.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          status: { type: "string", description: "active | paid | defaulted" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payroll_runs",
      description: "Get recent payroll runs with totals.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", default: 12 },
          branch_id: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_payslips",
      description: "Get payslips, optionally filtered by employee or payroll run.",
      parameters: {
        type: "object",
        properties: {
          employee_id: { type: "string" },
          payroll_run_id: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_branches",
      description: "List all branches.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function executeTool(supa: any, name: string, args: any) {
  switch (name) {
    case "list_employees": {
      let q = supa.from("employees").select("id, employee_code, full_name, position, department, branch_id, status, base_salary, hire_date").limit(args.limit ?? 50);
      if (args.status) q = q.eq("status", args.status);
      if (args.branch_id) q = q.eq("branch_id", args.branch_id);
      if (args.search) q = q.or(`full_name.ilike.%${args.search}%,employee_code.ilike.%${args.search}%`);
      const { data, error } = await q;
      return error ? { error: error.message } : { count: data?.length, employees: data };
    }
    case "get_employee_details": {
      let q = supa.from("employees").select("*");
      if (args.employee_id) q = q.eq("id", args.employee_id);
      else if (args.employee_code) q = q.eq("employee_code", args.employee_code);
      const { data, error } = await q.maybeSingle();
      return error ? { error: error.message } : { employee: data };
    }
    case "get_attendance_summary": {
      let q = supa.from("attendance").select("*, employees(full_name, employee_code)").gte("date", args.date_from).lte("date", args.date_to);
      if (args.employee_id) q = q.eq("employee_id", args.employee_id);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const total_records = data?.length || 0;
      const present = data?.filter((r: any) => r.status === "present").length || 0;
      const absent = data?.filter((r: any) => r.status === "absent").length || 0;
      const late = data?.filter((r: any) => r.status === "late").length || 0;
      const total_hours = data?.reduce((s: number, r: any) => s + Number(r.hours_worked || 0), 0) || 0;
      return { total_records, present, absent, late, total_hours, records: data?.slice(0, 30) };
    }
    case "get_leave_requests": {
      let q = supa.from("leave_requests").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false });
      if (args.status) q = q.eq("status", args.status);
      if (args.employee_id) q = q.eq("employee_id", args.employee_id);
      const { data, error } = await q.limit(50);
      return error ? { error: error.message } : { count: data?.length, leaves: data };
    }
    case "get_loans": {
      let q = supa.from("employee_loans").select("*, employees(full_name, employee_code)");
      if (args.employee_id) q = q.eq("employee_id", args.employee_id);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const total_outstanding = data?.reduce((s: number, l: any) => s + Number(l.remaining_balance || 0), 0) || 0;
      return { count: data?.length, total_outstanding, loans: data };
    }
    case "get_payroll_runs": {
      let q = supa.from("payroll_runs").select("*, branches(name)").order("created_at", { ascending: false }).limit(args.limit ?? 12);
      if (args.branch_id) q = q.eq("branch_id", args.branch_id);
      const { data, error } = await q;
      return error ? { error: error.message } : { runs: data };
    }
    case "get_payslips": {
      let q = supa.from("payslips").select("*, employees(full_name, employee_code)").order("created_at", { ascending: false }).limit(args.limit ?? 20);
      if (args.employee_id) q = q.eq("employee_id", args.employee_id);
      if (args.payroll_run_id) q = q.eq("payroll_run_id", args.payroll_run_id);
      const { data, error } = await q;
      return error ? { error: error.message } : { count: data?.length, payslips: data };
    }
    case "get_branches": {
      const { data, error } = await supa.from("branches").select("*").order("name");
      return error ? { error: error.message } : { branches: data };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use the user's own client so RLS scopes data to what the user can legitimately see.
    const supa = userClient;

    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const conversation: any[] = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];

    // Run up to 5 tool-call rounds
    for (let round = 0; round < 5; round++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conversation,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });

      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await aiResp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;

      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg);
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          const result = await executeTool(supa, tc.function.name, args);
          conversation.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result).slice(0, 12000),
          });
        }
        continue;
      }

      // No more tool calls — return final answer
      return new Response(JSON.stringify({ reply: msg?.content || "(no response)", rounds: round + 1 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ reply: "Sorry, I couldn't complete that request — please try a more specific question." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hr-ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
