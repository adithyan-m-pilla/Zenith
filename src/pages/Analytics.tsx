import { BarChart3, TrendingUp, Coffee, Flame } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const weekData = [
  { day: "Mon", hours: 4.5 }, { day: "Tue", hours: 3.2 }, { day: "Wed", hours: 5.1 },
  { day: "Thu", hours: 2.0 }, { day: "Fri", hours: 6.3 }, { day: "Sat", hours: 4.8 }, { day: "Sun", hours: 1.5 },
];

const stats = [
  { label: "Consistent Days", value: "18", icon: TrendingUp, desc: "Days with 3+ hours" },
  { label: "Lazy Days", value: "5", icon: Coffee, desc: "Days with <1 hour" },
  { label: "Most Productive", value: "Friday", icon: Flame, desc: "Avg 5.8 hrs" },
];

const Analytics = () => {
  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" /> Analytics
        </h1>
        <p className="text-muted-foreground mt-1">Track your study consistency</p>
      </div>

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
    </div>
  );
};

export default Analytics;
