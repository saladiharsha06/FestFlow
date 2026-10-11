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
    console.log("\n=== Supabase Collector Security Test ===\n");

    // Enter credentials locally in the terminal.
    const supabaseUrl = (await ask("Supabase project URL: ")).trim();
    const supabaseKey = (await ask("Supabase publishable key: ")).trim();
    const email = (await ask("Collector email: ")).trim();
    const password = await ask("Collector password: ");

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("\nSigning in...\n");

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      console.log("FAIL: Login failed:", loginError.message);
      return;
    }

    const userId = loginData.user.id;

    console.log("PASS: Login successful.");
    console.log("Collector user ID:", userId);

    // Confirm the signed-in user's role.
    const { data: role, error: roleError } =
      await supabase.rpc("get_my_role");

    if (roleError) {
      console.log("FAIL: Could not retrieve user role:", roleError.message);
      return;
    }

    console.log("Detected role:", role);

    if (role !== "collector") {
      console.log("STOP: This test must be run using the collector account.");
      return;
    }

    // Test only the remaining three tables.
    const tests = [
      {
        table: "personal_collection_1",
        label: "Personal Collection 1",
        createRecord: (marker) => ({
          name: marker,
          amount: 1,
          payment_mode: "Other",
          remarks: "Temporary security test record",
          created_by: userId,
        }),
      },
      {
        table: "personal_collection_2",
        label: "Personal Collection 2",
        createRecord: (marker) => ({
          name: marker,
          amount: 1,
          payment_mode: "Other",
          remarks: "Temporary security test record",
          created_by: userId,
        }),
      },
      {
        table: "material_donations",
        label: "Material Donations",
        createRecord: (marker) => ({
          name: marker,
          item: marker,
          quantity: 1,
          unit: "test",
          remarks: "Temporary security test record",
          created_by: userId,
        }),
      },
    ];

    const createdRecords = [];

    for (const test of tests) {
      console.log(`\n--- Testing ${test.label} ---`);

      const marker = `SECURITY_TEST_${test.table}_${Date.now()}`;

      // 1. Test whether the collector can insert a record.
      const { data: inserted, error: insertError } = await supabase
        .from(test.table)
        .insert(test.createRecord(marker))
        .select("id, name, created_by, remarks")
        .single();

      if (insertError) {
        console.log("FAIL: Insert failed:", insertError.message);
        continue;
      }

      console.log("PASS: Collector inserted a temporary record.");
      console.log("Temporary record ID:", inserted.id);
      console.log("Temporary marker:", marker);

      createdRecords.push({
        table: test.table,
        id: inserted.id,
        marker,
      });

      // 2. Test whether the collector can edit their own record.
      const updatedRemarks = `Collector edit test ${Date.now()}`;

      const { data: updated, error: updateError } = await supabase
        .from(test.table)
        .update({ remarks: updatedRemarks })
        .eq("id", inserted.id)
        .select("id, remarks");

      if (
        !updateError &&
        updated &&
        updated.length === 1 &&
        updated[0].remarks === updatedRemarks
      ) {
        console.log("PASS: Collector can edit their own record.");
      } else {
        console.log(
          "FAIL: Own-record edit was not confirmed.",
          updateError?.message || ""
        );
      }

      // 3. Test whether the collector can delete their own record.
      const { data: deleted, error: deleteError } = await supabase
        .from(test.table)
        .delete()
        .eq("id", inserted.id)
        .select("id");

      if (deleteError) {
        console.log(
          "DELETE BLOCKED: Supabase returned an error:",
          deleteError.message
        );
      } else if (!deleted || deleted.length === 0) {
        console.log(
          "PASS: No record was deleted; the deletion policy appears to block it."
        );
      } else {
        console.log(
          "WARNING: The record was deleted. Review the DELETE policy immediately."
        );
      }
    }

    console.log("\n=== TEST SUMMARY ===");

    if (createdRecords.length > 0) {
      console.log(
        "\nTemporary records created by this test:"
      );

      for (const record of createdRecords) {
        console.log(
          `Table: ${record.table} | ID: ${record.id} | Marker: ${record.marker}`
        );
      }

      console.log(
        "\nThese records have NOT been automatically cleaned up."
      );
      console.log(
        "Keep them until we review the results and arrange safe cleanup."
      );
    }

    console.log(
      "\nNOTE: This test does not verify whether a collector can edit another user's record."
    );

    await supabase.auth.signOut();
    console.log("\nSigned out.");
  } catch (error) {
    console.log("\nUNEXPECTED TEST ERROR:", error.message);
  } finally {
    rl.close();
  }
}

main();