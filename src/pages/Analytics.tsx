import { BarChart3, TrendingUp, Coffee, Flame, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay } from "date-fns";

interface DayData {
  day: string;
  hours: number;
  minutes: number;
}

const Analytics = () => {
  const { user } = useAuth();
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const sevenDaysAgo = startOfDay(subDays(new Date(), 6));

      const { data, error } = await supabase
        .from("study_sessions")
        .select("duration_minutes, completed_at")
        .eq("user_id", user.id)
        .gte("completed_at", sevenDaysAgo.toISOString())
        .order("completed_at", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      setTotalSessions(data.length);

      // Group by day
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = subDays(new Date(), 6 - i);
        dayMap[format(d, "EEE")] = 0;
      }

      data.forEach((s) => {
        const dayLabel = format(new Date(s.completed_at), "EEE");
        if (dayMap[dayLabel] !== undefined) {
          dayMap[dayLabel] += s.duration_minutes;
        }
      });

      setWeekData(
        Object.entries(dayMap).map(([day, mins]) => ({
          day,
          hours: Math.round((mins / 60) * 10) / 10,
          minutes: mins,
        }))
      );
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const totalMinutes = weekData.reduce((s, d) => s + d.minutes, 0);
  const consistentDays = weekData.filter((d) => d.minutes >= 180).length;
  const lazyDays = weekData.filter((d) => d.minutes < 60).length;
  const mostProductive = weekData.reduce((best, d) => (d.minutes > best.minutes ? d : best), weekData[0]);

  const stats = weekData.length > 0
    ? [
        { label: "Consistent Days", value: String(consistentDays), icon: TrendingUp, desc: "Days with 3+ hours" },
        { label: "Lazy Days", value: String(lazyDays), icon: Coffee, desc: "Days with <1 hour" },
        { label: "Most Productive", value: mostProductive?.day || "-", icon: Flame, desc: `${mostProductive?.hours || 0} hrs` },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" /> Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          {totalSessions} sessions · {Math.round(totalMinutes / 60 * 10) / 10} hrs this week
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : weekData.length === 0 || totalMinutes === 0 ? (
        <div className="glass-card p-10 text-center animate-fade-in">
          <p className="text-muted-foreground">No study sessions yet. Complete a Pomodoro to see your stats!</p>
        </div>
      ) : (
        <>
          <div className="glass-card p-5 animate-fade-in">
            <h3 className="font-heading font-semibold text-foreground mb-4">This Week</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 18%)" />
                <XAxis dataKey="day" stroke="hsl(220 10% 55%)" fontSize={12} />
                <YAxis stroke="hsl(220 10% 55%)" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(220 18% 10%)", border: "1px solid hsl(220 14% 18%)", borderRadius: "8px", color: "hsl(150 10% 90%)" }}
                />
                <Bar dataKey="hours" fill="hsl(152 60% 48%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in">
            {stats.map(({ label, value, icon: Icon, desc }) => (
              <div key={label} className="glass-card p-5">
                <Icon className="w-5 h-5 text-primary mb-2" />
                <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
