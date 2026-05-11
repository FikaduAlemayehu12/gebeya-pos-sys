// MoR sync worker — exponential backoff retry processor (no real MoR API yet; simulates HTTP send).
// Schedules: also called from pg_cron every 5 minutes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BACKOFF_MIN = [1, 5, 30, 120, 480, 1440]; // minutes between attempts

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const workerId = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: items, error } = await supabase
    .from('mor_sync_queue')
    .select('*')
    .in('status', ['pending', 'failed'])
    .lte('next_attempt_at', now)
    .order('next_attempt_at', { ascending: true })
    .limit(25);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let sent = 0, failed = 0, dead = 0;

  for (const item of items || []) {
    const attempts = (item.attempts || 0) + 1;
    let success = false;
    let lastError: string | null = null;

    try {
      // Stub: simulate sending to MoR. Replace with real fetch when API is provided.
      // Failure simulation: only ~10% to exercise retry logic; remove when wired.
      if (Math.random() < 0.1) throw new Error('Simulated MoR transient 503');
      success = true;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    if (success) {
      await supabase.from('mor_sync_queue').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        last_attempt_at: new Date().toISOString(),
        attempts,
        worker_id: workerId,
        last_error: null,
      }).eq('id', item.id);
      sent++;
    } else if (attempts >= (item.max_attempts || 6)) {
      await supabase.from('mor_sync_queue').update({
        status: 'dead',
        last_attempt_at: new Date().toISOString(),
        attempts,
        last_error: lastError,
        worker_id: workerId,
      }).eq('id', item.id);
      dead++;
    } else {
      const minutes = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)];
      const next = new Date(Date.now() + minutes * 60_000).toISOString();
      await supabase.from('mor_sync_queue').update({
        status: 'failed',
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: next,
        attempts,
        last_error: lastError,
        worker_id: workerId,
      }).eq('id', item.id);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ workerId, processed: items?.length || 0, sent, failed, dead }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
