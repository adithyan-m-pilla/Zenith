import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import TodayTasks from "@/components/dashboard/TodayTasks";
import SyllabusProgress from "@/components/dashboard/SyllabusProgress";
import SubjectCards from "@/components/dashboard/SubjectCards";
import StudyCalendar from "@/components/dashboard/StudyCalendar";
import { format } from "date-fns";

const Index = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const todayFormatted = format(new Date(), "EEEE, MMMM d, yyyy");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {greeting}, <span className="text-primary">{displayName || "Scholar"}</span> 👋
        </h1>
        <p className="text-muted-foreground mt-1">{todayFormatted}</p>
        <p className="text-muted-foreground text-sm">Let's make today productive.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TodayTasks />
          <SyllabusProgress />
          <SubjectCards />
        </div>
        <div className="lg:col-span-1">
          <StudyCalendar />
        </div>
      </div>
    </div>
  );
};

export default Index;
