const { createClient } = require("@supabase/supabase-js");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const ask = (question) => rl.question(question);

async function main() {
  try {
    console.log("\n=== Admin-Owned Record Security Test ===\n");

    const supabaseUrl = (await ask("Supabase project URL: ")).trim();
    const supabaseKey = (await ask("Supabase publishable key: ")).trim();
    const email = (await ask("Admin email: ")).trim();
    const password = await ask("Admin password: ");

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("\nSigning in as admin...");

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      console.log("FAIL: Admin login failed:", loginError.message);
      return;
    }

    const userId = loginData.user.id;

    console.log("PASS: Admin login successful.");

    const { data: role, error: roleError } =
      await supabase.rpc("get_my_role");

    if (roleError) {
      console.log("FAIL: Could not verify admin role:", roleError.message);
      return;
    }

    console.log("Detected role:", role);

    if (role !== "admin") {
      console.log("STOP: This account does not have the admin role.");
      return;
    }

    const marker = `ADMIN_SECURITY_TEST_${Date.now()}`;

    console.log("\nCreating a temporary admin-owned record...");

    const { data: record, error: insertError } = await supabase
      .from("money_collections")
      .insert({
        name: marker,
        amount: 1,
        payment_mode: "Other",
        remarks: "Temporary admin security test record",
        created_by: userId,
      })
      .select("id, name, created_by")
      .single();

    if (insertError) {
      console.log("FAIL: Could not create test record:");
      console.log(insertError.message);
      return;
    }

    console.log("\nPASS: Temporary admin-owned record created.");
    console.log("Table: money_collections");
    console.log("Record ID:", record.id);
    console.log("Marker:", record.name);
    console.log("Owner user ID:", record.created_by);

    console.log("\nIMPORTANT:");
    console.log("Do not edit or delete this record manually.");
    console.log("We will use it for the collector permission test.");

    await supabase.auth.signOut();
    console.log("\nAdmin signed out.");
  } catch (error) {
    console.log("\nUNEXPECTED ERROR:", error.message);
  } finally {
    rl.close();
  }
}

main();