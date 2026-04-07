import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const StudyCalendar = () => {
  const { user } = useAuth();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = today.toLocaleString("default", { month: "long", year: "numeric" });

  const [studyData, setStudyData] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!user) return;
    const startOfMonth = new Date(year, month, 1).toISOString();
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    supabase
      .from("study_sessions")
      .select("completed_at, duration_minutes")
      .eq("user_id", user.id)
      .gte("completed_at", startOfMonth)
      .lte("completed_at", endOfMonth)
      .then(({ data }) => {
        const grouped: Record<number, number> = {};
        (data || []).forEach((s) => {
          const day = new Date(s.completed_at).getDate();
          grouped[day] = (grouped[day] || 0) + (s.duration_minutes || 0);
        });
        // Convert minutes to hours
        const hours: Record<number, number> = {};
        Object.entries(grouped).forEach(([d, m]) => {
          hours[Number(d)] = Math.round((m / 60) * 10) / 10;
        });
        setStudyData(hours);
      });
  }, [user, year, month]);

  const getHeatColor = (hours: number | undefined) => {
    if (!hours || hours === 0) return "bg-heatmap-0";
    if (hours >= 5) return "bg-heatmap-3";
    if (hours >= 3) return "bg-heatmap-2";
    return "bg-heatmap-1";
  };

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="glass-card p-4 sm:p-5 animate-fade-in">
      <h3 className="font-heading font-semibold text-foreground mb-4 text-sm sm:text-base">{monthName}</h3>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2">
        {days.map((d) => (
          <div key={d} className="text-[9px] sm:text-[10px] text-muted-foreground text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="w-full aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <div
            key={day}
            className={`w-full aspect-square rounded-sm ${getHeatColor(studyData[day])} transition-colors relative group cursor-default`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] text-foreground/60">
              {day}
            </span>
            {studyData[day] !== undefined && studyData[day] > 0 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-[10px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {studyData[day]}h studied
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 justify-end">
        <span className="text-[9px] sm:text-[10px] text-muted-foreground">Less</span>
        <div className="w-3 h-3 rounded-sm bg-heatmap-0" />
        <div className="w-3 h-3 rounded-sm bg-heatmap-1" />
        <div className="w-3 h-3 rounded-sm bg-heatmap-2" />
        <div className="w-3 h-3 rounded-sm bg-heatmap-3" />
        <span className="text-[9px] sm:text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
};

export default StudyCalendar;
