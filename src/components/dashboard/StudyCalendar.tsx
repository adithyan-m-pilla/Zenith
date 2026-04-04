import { useMemo } from "react";

const StudyCalendar = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const monthName = today.toLocaleString("default", { month: "long", year: "numeric" });

  // Mock study data (hours per day)
  const studyData = useMemo(() => {
    const data: Record<number, number> = {};
    for (let i = 1; i <= daysInMonth; i++) {
      if (i <= today.getDate()) {
        data[i] = Math.random() > 0.3 ? Math.floor(Math.random() * 7) : 0;
      }
    }
    return data;
  }, [daysInMonth]);

  const getHeatColor = (hours: number | undefined) => {
    if (!hours || hours === 0) return "bg-heatmap-0";
    if (hours >= 5) return "bg-heatmap-3";
    if (hours >= 3) return "bg-heatmap-2";
    return "bg-heatmap-1";
  };

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-heading font-semibold text-foreground mb-4">{monthName}</h3>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {days.map((d) => (
          <div key={d} className="text-[10px] text-muted-foreground text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="w-full aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
          <div
            key={day}
            className={`w-full aspect-square rounded-sm ${getHeatColor(studyData[day])} transition-colors relative group cursor-default`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-foreground/60">
              {day}
            </span>
            {studyData[day] !== undefined && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-[10px] text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {studyData[day]}h studied
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 justify-end">
        <span className="text-[10px] text-muted-foreground">Less</span>
        {[0, 1, 2, 3].map((level) => (
          <div key={level} className={`w-3 h-3 rounded-sm bg-heatmap-${level}`} />
        ))}
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
};

export default StudyCalendar;
