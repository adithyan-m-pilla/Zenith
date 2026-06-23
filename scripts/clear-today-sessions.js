// Quick console command to clear today's study sessions
// Run this in browser console while logged in to Zenith

async function clearTodaySessions() {
  // Get today's start in UTC
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  console.log(`🗑️ Clearing study sessions for today (${todayStart.toISOString()} to ${tomorrowStart.toISOString()})`);

  // This uses the supabase client already loaded in your app
  try {
    const { error, count } = await window.__zenith_supabase
      .from("study_sessions")
      .delete()
      .gte("completed_at", todayStart.toISOString())
      .lt("completed_at", tomorrowStart.toISOString());

    if (error) {
      console.error("❌ Error deleting sessions:", error);
    } else {
      console.log(`✅ Cleared ${count} study sessions for today`);
    }
  } catch (e) {
    console.error("❌ Error:", e.message);
  }
}

// Run it
clearTodaySessions();
