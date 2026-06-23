import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const clearTodaySessions = async () => {
  // Get today's start in UTC
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  console.log(`Clearing study sessions for today (${todayStart.toISOString()} to ${tomorrowStart.toISOString()})`);

  // Delete all sessions for today
  const { data: deleted, error } = await supabase
    .from("study_sessions")
    .delete()
    .gte("completed_at", todayStart.toISOString())
    .lt("completed_at", tomorrowStart.toISOString());

  if (error) {
    console.error("Error deleting sessions:", error);
    process.exit(1);
  }

  console.log(`✅ Deleted sessions. Count: ${deleted?.length || 0}`);
};

clearTodaySessions();
