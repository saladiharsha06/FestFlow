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
    console.log("\n=== Admin Delete Permission Test ===\n");

    const url = (await ask("Supabase project URL: ")).trim();
    const key = (await ask("Supabase publishable key: ")).trim();
    const email = (await ask("Admin email: ")).trim();
    const password = await ask("Admin password: ");

    const supabase = createClient(url, key);

    console.log("\nSigning in as admin...");

    const { data: login, error: loginError } =
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
      console.log("FAIL: Could not verify role:", roleError.message);
      return;
    }

    console.log("Detected role:", role);

    if (role !== "admin") {
      console.log("STOP: Please use the admin account.");
      return;
    }

    // Create a uniquely marked temporary record.
    const marker = `ADMIN_DELETE_TEST_${Date.now()}`;

    console.log("\nCreating a temporary test record...");

    const { data: record, error: insertError } = await supabase
      .from("money_collections")
      .insert({
        name: marker,
        amount: 1,
        payment_mode: "Other",
        remarks: "Temporary admin deletion permission test",
        created_by: login.user.id,
      })
      .select("id, name")
      .single();

    if (insertError) {
      console.log("FAIL: Could not create test record:");
      console.log(insertError.message);
      return;
    }

    console.log("PASS: Temporary record created.");
    console.log("Record ID:", record.id);
    console.log("Marker:", record.name);

    // Delete only the record created by this script.
    console.log("\nTesting admin deletion...");

    const { data: deleted, error: deleteError } = await supabase
      .from("money_collections")
      .delete()
      .eq("id", record.id)
      .eq("name", marker)
      .eq("created_by", login.user.id)
      .select("id");

    if (deleteError) {
      console.log("FAIL: Delete request failed:");
      console.log(deleteError.message);
      console.log(
        "The temporary record may still exist; do not rerun the script yet."
      );
      return;
    }

    if (deleted && deleted.length === 1) {
      console.log("PASS: Admin deleted the temporary record.");
    } else {
      console.log("FAIL: Deletion was not confirmed.");
      console.log(
        "The temporary record may still exist; do not rerun the script yet."
      );
      return;
    }

    // Verify that this exact record no longer exists.
    const { data: remaining, error: verifyError } = await supabase
      .from("money_collections")
      .select("id")
      .eq("id", record.id)
      .eq("name", marker);

    if (verifyError) {
      console.log(
        "WARNING: Could not verify deletion:",
        verifyError.message
      );
    } else if (!remaining || remaining.length === 0) {
      console.log("PASS: Verified that the temporary record no longer exists.");
    } else {
      console.log("WARNING: The temporary record still exists.");
    }

    await supabase.auth.signOut();
    console.log("\nAdmin signed out.");
  } catch (error) {
    console.log("\nUNEXPECTED ERROR:", error.message);
  } finally {
    rl.close();
  }
}

main();