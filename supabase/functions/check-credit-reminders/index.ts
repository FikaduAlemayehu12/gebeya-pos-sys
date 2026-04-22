import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find credit sales due today or overdue
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Get active/partial credits that are due today or overdue
    const { data: dueCredits, error: creditsErr } = await supabase
      .from('credit_sales')
      .select('*, customers(id, name, name_am, phone, email, telegram_chat_id)')
      .in('status', ['active', 'partial'])
      .lte('due_date', now.toISOString());

    if (creditsErr) throw creditsErr;

    const results: any[] = [];

    for (const credit of (dueCredits || [])) {
      const customer = credit.customers;
      if (!customer) continue;

      const remaining = credit.total_amount - credit.paid_amount;
      const dueDate = new Date(credit.due_date).toLocaleDateString();

      // Update status to overdue if not already
      if (credit.status !== 'overdue') {
        await supabase.from('credit_sales').update({ status: 'overdue' }).eq('id', credit.id);
      }

      // Create system notification for all admins and cashiers
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'cashier']);

      if (staffRoles) {
        const notifications = staffRoles.map((r: any) => ({
          user_id: r.user_id,
          title: `⏰ Credit Due: ${customer.name}`,
          message: `${customer.name} owes ${remaining.toFixed(2)} ETB. Due date: ${dueDate}. Please follow up.`,
          type: 'credit_reminder',
          related_id: credit.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      // Send SMS reminder via Twilio
      if (customer.phone) {
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
        const TWILIO_PHONE = Deno.env.get('TWILIO_PHONE_NUMBER');
        if (LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_PHONE) {
          const phone = customer.phone.startsWith('+') ? customer.phone : `+251${customer.phone.replace(/^0/, '')}`;
          try {
            await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                'X-Connection-Api-Key': TWILIO_API_KEY,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: phone,
                From: TWILIO_PHONE,
                Body: `GEBEYA POS Reminder: Dear ${customer.name}, you have an outstanding credit of ETB ${remaining.toFixed(2)} due on ${dueDate}. Please settle your balance. Thank you! / ውድ ${customer.name}፣ የ ETB ${remaining.toFixed(2)} ብድር ቀሪ ሂሳብ አለዎት። እባክዎ ይክፈሉ። እናመሰግናለን!`,
              }),
            });
          } catch (smsErr) {
            console.error('SMS send failed:', smsErr);
          }
        }
      }

      results.push({
        customer_id: customer.id,
        customer_name: customer.name,
        remaining,
        due_date: dueDate,
        notified_staff: true,
        sms_sent: !!customer.phone,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      checked_at: now.toISOString(),
      reminders_sent: results.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
