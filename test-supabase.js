require("dotenv").config();
console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log("SUPABASE_KEY loaded:", !!process.env.SUPABASE_KEY);

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from("receipts").select("*").limit(1);
  if (error) console.error("❌ Error:", error);
  else console.log("✅ Connected! Sample row:", data);
}
test();
