import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let createdUserId: string | null = null;
  try {
    const body = await req.json();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return jsonResponse({ error: "Choose a username with 3–30 lowercase letters, numbers, or underscores." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Enter a valid email address." }, 400);
    }
    if (password.length < 8) {
      return jsonResponse({ error: "Password must contain at least 8 characters." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("USER_LOOKUP_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("Registration function is missing server configuration.");
      return jsonResponse({ error: "Registration is temporarily unavailable. Please try again later." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existingProfile, error: profileLookupError } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;
    if (existingProfile) return jsonResponse({ error: "That username is already taken. Please choose another." }, 409);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return jsonResponse({ error: "That email is already registered. Please log in or use password recovery." }, 409);
      }
      console.error("Supabase account creation failed:", createError.message);
      return jsonResponse({ error: "Could not create your account. Please check your details and try again." }, 400);
    }
    if (!created.user) throw new Error("Supabase did not return the created user.");
    createdUserId = created.user.id;

    const { error: insertProfileError } = await admin
      .from("user_profiles")
      .insert({ user_id: createdUserId, username });
    if (insertProfileError) throw insertProfileError;

    // New accounts are intentionally not given the legacy admin/collector role.
    // Committee membership and collection permissions must be assigned through
    // the committee onboarding flow, not granted globally at registration.
    return jsonResponse({ success: true, message: "Account created successfully." }, 201);
  } catch (error) {
    console.error("Registration function error:", error instanceof Error ? error.message : error);
    if (createdUserId) {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("USER_LOOKUP_SERVICE_ROLE_KEY");
      if (url && key) {
        const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error: rollbackError } = await admin.auth.admin.deleteUser(createdUserId);
        if (rollbackError) console.error("Could not roll back incomplete registration:", rollbackError.message);
      }
    }
    return jsonResponse({ error: "Could not complete registration. Please try again." }, 500);
  }
});
