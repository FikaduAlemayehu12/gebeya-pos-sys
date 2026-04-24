import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Caller must be a global admin
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', caller.id).eq('role', 'admin').single()

    if (!callerRole) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const {
      email, password, full_name, father_name, grandfather_name, phone,
      role, access_level,
      // multi-tenancy: which company to attach the new user to.
      // If omitted, fall back to the caller's default company.
      company_id, member_role,
    } = body

    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: 'Email, password, and full_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const validRoles = ['admin', 'cashier', 'inventory_manager', 'hr_admin', 'payroll_officer', 'manager', 'employee', 'finance_manager', 'auditor', 'branch_manager', 'procurement']
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve target company
    let targetCompanyId: string | null = company_id || null
    if (!targetCompanyId) {
      const { data: defaultMembership } = await supabaseAdmin
        .from('company_members')
        .select('company_id')
        .eq('user_id', caller.id)
        .eq('is_default', true)
        .maybeSingle()
      targetCompanyId = defaultMembership?.company_id || null
    }
    if (!targetCompanyId) {
      // last-resort fallback: any company the caller belongs to
      const { data: any } = await supabaseAdmin
        .from('company_members').select('company_id').eq('user_id', caller.id).limit(1).maybeSingle()
      targetCompanyId = (any as any)?.company_id || null
    }
    if (!targetCompanyId) {
      return new Response(JSON.stringify({ error: 'No target company found for this admin' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Caller must belong to (and ideally manage) the target company
    const { data: callerMembership } = await supabaseAdmin
      .from('company_members')
      .select('member_role')
      .eq('user_id', caller.id)
      .eq('company_id', targetCompanyId)
      .maybeSingle()
    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.member_role)) {
      return new Response(JSON.stringify({ error: 'You must own or admin this company to invite users' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name },
    })
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newUserId = newUser.user!.id

    // Update profile
    await supabaseAdmin.from('profiles').update({
      full_name,
      father_name: father_name || '',
      grandfather_name: grandfather_name || '',
      phone: phone || '',
      created_by_admin: caller.id,
    }).eq('user_id', newUserId)

    // Assign global role (the trigger already inserted 'employee'; we add the chosen one too)
    await supabaseAdmin.from('user_roles').insert({
      user_id: newUserId, role, access_level: access_level || 'full',
    })

    // Add as member of the target company
    await supabaseAdmin.from('company_members').insert({
      company_id: targetCompanyId,
      user_id: newUserId,
      member_role: member_role || (role === 'admin' ? 'admin' : 'member'),
      is_default: true,
    })

    return new Response(JSON.stringify({
      success: true, user_id: newUserId, company_id: targetCompanyId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
