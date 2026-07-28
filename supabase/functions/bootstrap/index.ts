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
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: 'Email, password and name are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Guard: bootstrap only works when zero super_admins exist.
    const { count, error: countError } = await supabaseAdmin
      .from('super_admins')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    if (count && count > 0) {
      return new Response(
        JSON.stringify({ error: 'Bootstrap is no longer available. An admin account already exists.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the auth user with super_admin role in app_metadata.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'super_admin' },
    });

    if (authError) throw authError;
    const userId = authData.user.id;

    // Insert the super_admins profile row.
    const { error: profileError } = await supabaseAdmin
      .from('super_admins')
      .insert({ id: userId, email, name });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({ message: 'Super admin account created. You can now sign in at /admin.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
