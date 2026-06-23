import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { supabase } from "@/integrations/supabase/client";

// Expose clear today's sessions to window for console access
(window as any).zenithClearToday = async (userId: string) => {
  if (!userId) {
    console.error("❌ User ID required");
    return false;
  }
  
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  );
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  console.log(`🗑️ Clearing sessions from ${todayStart.toISOString()} to ${tomorrowStart.toISOString()}...`);

  try {
    const { error, count } = await supabase
      .from("study_sessions")
      .delete()
      .eq("user_id", userId)
      .gte("completed_at", todayStart.toISOString())
      .lt("completed_at", tomorrowStart.toISOString());

    if (error) {
      console.error("❌ Error clearing sessions:", error);
      return false;
    }

    console.log(`✅ Cleared ${count || 0} study sessions for today`);
    
    // Dispatch event to refresh Friends leaderboard
    window.dispatchEvent(new Event("zenith:study-update"));
    
    return true;
  } catch (e) {
    console.error("❌ Error:", e);
    return false;
  }
};

createRoot(document.getElementById("root")!).render(<App />);
