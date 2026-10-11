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
    console.log("\n=== Cross-User Security Test ===\n");

    const supabaseUrl = (await ask("Supabase project URL: ")).trim();
    const supabaseKey = (await ask("Supabase publishable key: ")).trim();
    const email = (await ask("Collector email: ")).trim();
    const password = await ask("Collector password: ");

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("\nSigning in as collector...");

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      console.log("FAIL: Login failed:", loginError.message);
      return;
    }

    console.log("PASS: Login successful.");

    const { data: role, error: roleError } =
      await supabase.rpc("get_my_role");

    if (roleError) {
      console.log("FAIL: Could not retrieve role:", roleError.message);
      return;
    }

    console.log("Detected role:", role);

    if (role !== "collector") {
      console.log("STOP: Sign in using the collector account.");
      return;
    }

    // This is the admin-owned test record created earlier.
    const adminRecordId = 2;
    const testMarker = "ADMIN_SECURITY_TEST_1791612157423";

    console.log("\nChecking whether the admin test record exists...");

    const { data: record, error: readError } = await supabase
      .from("money_collections")
      .select("id, name, remarks, created_by")
      .eq("id", adminRecordId)
      .eq("name", testMarker)
      .maybeSingle();

    if (readError) {
      console.log("FAIL: Could not check the record:", readError.message);
      return;
    }

    if (!record) {
      console.log("STOP: The admin test record was not found.");
      console.log("It may have been deleted, or its ID/marker may have changed.");
      return;
    }

    console.log("PASS: Collector can view the admin-owned record.");
    console.log("Record ID:", record.id);
    console.log("Marker:", record.name);

    // Try to change only the temporary test record's remarks.
    const attemptedRemarks = `UNAUTHORIZED_EDIT_TEST_${Date.now()}`;

    console.log("\nAttempting to edit the admin-owned record...");

    const { data: updatedRows, error: updateError } = await supabase
      .from("money_collections")
      .update({ remarks: attemptedRemarks })
      .eq("id", adminRecordId)
      .eq("name", testMarker)
      .select("id, remarks");

    if (updateError) {
      console.log("PASS: Supabase rejected the update.");
      console.log("Response:", updateError.message);
    } else if (!updatedRows || updatedRows.length === 0) {
      console.log("PASS: Update blocked; no record was changed.");
    } else {
      console.log("FAIL: Collector successfully changed an admin-owned record!");
      console.log("Updated rows:", updatedRows);
    }

    await supabase.auth.signOut();
    console.log("\nCollector signed out.");
  } catch (error) {
    console.log("\nUNEXPECTED ERROR:", error.message);
  } finally {
    rl.close();
  }
}

main();