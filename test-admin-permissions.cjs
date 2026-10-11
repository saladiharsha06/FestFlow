const { createClient } = require("@supabase/supabase-js");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const ask = (question) => rl.question(question);

const tables = [
  {
    name: "money_collections",
    label: "Money Collections",
    createRecord: (marker, userId) => ({
      name: marker,
      amount: 1,
      payment_mode: "Other",
      remarks: "Temporary admin permission test",
      created_by: userId,
    }),
  },
  {
    name: "personal_collection_1",
    label: "Personal Collection 1",
    createRecord: (marker, userId) => ({
      name: marker,
      amount: 1,
      payment_mode: "Other",
      remarks: "Temporary admin permission test",
      created_by: userId,
    }),
  },
  {
    name: "personal_collection_2",
    label: "Personal Collection 2",
    createRecord: (marker, userId) => ({
      name: marker,
      amount: 1,
      payment_mode: "Other",
      remarks: "Temporary admin permission test",
      created_by: userId,
    }),
  },
  {
    name: "material_donations",
    label: "Material Donations",
    createRecord: (marker, userId) => ({
      name: marker,
      item: marker,
      quantity: 1,
      unit: "test",
      remarks: "Temporary admin permission test",
      created_by: userId,
    }),
  },
];

async function main() {
  try {
    console.log("\n=== Admin Permissions Test ===\n");

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

    const userId = login.user.id;
    const createdRecords = [];

    for (const table of tables) {
      console.log(`\n--- ${table.label} ---`);

      // Test 1: Read records.
      const { error: readError } = await supabase
        .from(table.name)
        .select("id")
        .limit(1);

      if (readError) {
        console.log("FAIL: Read:", readError.message);
      } else {
        console.log("PASS: Admin can read the table.");
      }

      // Test 2: Insert a uniquely marked temporary record.
      const marker = `ADMIN_PERMISSION_TEST_${table.name}_${Date.now()}`;

      const { data: inserted, error: insertError } = await supabase
        .from(table.name)
        .insert(table.createRecord(marker, userId))
        .select("id, name, created_by")
        .single();

      if (insertError) {
        console.log("FAIL: Insert:", insertError.message);
        continue;
      }

      createdRecords.push({
        table: table.name,
        id: inserted.id,
        marker,
      });

      console.log("PASS: Admin can insert a record.");
      console.log("Temporary record ID:", inserted.id);
      console.log("Marker:", marker);

      // Test 3: Update only the temporary record.
      const updatedRemarks = `ADMIN_EDIT_TEST_${Date.now()}`;

      const { data: updated, error: updateError } = await supabase
        .from(table.name)
        .update({ remarks: updatedRemarks })
        .eq("id", inserted.id)
        .eq("name", marker)
        .select("id, remarks");

      if (
        !updateError &&
        updated &&
        updated.length === 1 &&
        updated[0].remarks === updatedRemarks
      ) {
        console.log("PASS: Admin can edit the temporary record.");
      } else {
        console.log(
          "FAIL: Edit was not confirmed:",
          updateError?.message || "No matching updated record returned."
        );
      }
    }

    console.log("\n=== TEMPORARY RECORD SUMMARY ===");

    for (const record of createdRecords) {
      console.log(
        `Table: ${record.table} | ID: ${record.id} | Marker: ${record.marker}`
      );
    }

    console.log(
      "\nThese records have NOT been deleted. Keep them until we finish reviewing the tests."
    );

    await supabase.auth.signOut();
    console.log("\nAdmin signed out.");
  } catch (error) {
    console.log("\nUNEXPECTED ERROR:", error.message);
  } finally {
    rl.close();
  }
}

main();