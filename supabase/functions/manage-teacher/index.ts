import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const role = user.app_metadata?.role;
    if (role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only super admins can manage teacher accounts.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'GET' ? 'list' : '');

    // GET ?action=list — every teacher across schools, with school name,
    // assigned classes, and last sign-in (from auth.users.last_sign_in_at).
    if (req.method === 'GET' && action === 'list') {
      const { data: teachers, error: tErr } = await supabaseAdmin
        .from('teachers')
        .select('id, school_id, name, email, created_at')
        .order('name');

      if (tErr) throw tErr;

      const { data: schools } = await supabaseAdmin
        .from('schools')
        .select('id, name');

      const { data: classes } = await supabaseAdmin
        .from('classes')
        .select('id, school_id, name, teacher_id');

      // Pull last_sign_in_at for every auth user that has a teacher row.
      const teacherIds = (teachers ?? []).map((t) => t.id);
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      const lastLogin: Record<string, string | null> = {};
      for (const u of authUsers?.users ?? []) {
        if (teacherIds.includes(u.id)) {
          lastLogin[u.id] = u.last_sign_in_at ?? null;
        }
      }

      const schoolMap: Record<string, string> = {};
      for (const s of schools ?? []) schoolMap[s.id] = s.name;

      const rows = (teachers ?? []).map((t) => {
        const assigned = (classes ?? []).filter((c) => c.teacher_id === t.id);
        return {
          id: t.id,
          name: t.name,
          email: t.email,
          school_id: t.school_id,
          school_name: schoolMap[t.school_id] ?? '—',
          classes: assigned.map((c) => c.name),
          last_login: lastLogin[t.id] ?? null,
          created_at: t.created_at,
        };
      });

      return new Response(JSON.stringify({ teachers: rows }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST ?action=reset-password — set a new password for a teacher.
    if (req.method === 'POST' && action === 'reset-password') {
      const { user_id, password } = await req.json();
      if (!user_id || !password) {
        return new Response(JSON.stringify({ error: 'user_id and password are required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
      return new Response(JSON.stringify({ message: 'Password updated.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST ?action=update-profile — update a teacher's name and/or email.
    if (req.method === 'POST' && action === 'update-profile') {
      const { user_id, name, email } = await req.json();
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id is required.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      // Update auth email if provided and different.
      if (email) {
        const { error: eErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
        if (eErr) throw eErr;
      }
      // Update teachers profile row.
      const patch: Record<string, string> = {};
      if (name) patch.name = name;
      if (email) patch.email = email;
      if (Object.keys(patch).length > 0) {
        const { error: pErr } = await supabaseAdmin.from('teachers').update(patch).eq('id', user_id);
        if (pErr) throw pErr;
      }
      return new Response(JSON.stringify({ message: 'Profile updated.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
