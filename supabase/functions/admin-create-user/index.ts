import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ROLES = ["student", "teacher", "admin"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) return respond({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Identify and authorize the caller
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return respond({ error: "Invalid session" }, 401);

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: callerData.user.id,
      _role: "admin",
    });
    if (roleErr) return respond({ error: roleErr.message }, 500);
    if (!isAdmin) return respond({ error: "Not authorized" }, 403);

    const { email, password, full_name, role } = await req.json();

    if (!email || typeof email !== "string") return respond({ error: "email is required" }, 400);
    if (!password || typeof password !== "string" || password.length < 6) {
      return respond({ error: "password must be at least 6 characters" }, 400);
    }
    if (!role || !VALID_ROLES.includes(role)) return respond({ error: "invalid role" }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });
    if (createErr || !created?.user) return respond({ error: createErr?.message || "Failed to create user" }, 400);

    const userId = created.user.id;

    // The handle_new_user trigger already created a profile (pending) and a
    // 'student' role. Admin-created users are approved immediately and get
    // the requested role.
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ approval_status: "approved" })
      .eq("id", userId);
    if (profileErr) return respond({ error: profileErr.message }, 500);

    const { error: delRoleErr } = await admin.from("user_roles").delete().eq("user_id", userId);
    if (delRoleErr) return respond({ error: delRoleErr.message }, 500);

    const { error: insRoleErr } = await admin.from("user_roles").insert({ user_id: userId, role });
    if (insRoleErr) return respond({ error: insRoleErr.message }, 500);

    return respond({ id: userId, email: created.user.email });
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
