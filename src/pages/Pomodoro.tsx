import { useEffect, useRef, useState } from "react";
import { Timer, Play, Pause, RotateCcw, Settings, Volume2, StopCircle, Plus } from "lucide-react";
import { usePomodoro, getStandardBreak } from "@/contexts/PomodoroContext";
import { toast } from "sonner";

type DisplayStyle = "digital" | "analog" | "minimal";

const themes = [
  { name: "Emerald", bg: "from-emerald-900/40 to-background", accent: "text-primary" },
  { name: "Ocean", bg: "from-blue-900/40 to-background", accent: "text-info" },
  { name: "Sunset", bg: "from-amber-900/40 to-background", accent: "text-warning" },
  { name: "Rose", bg: "from-rose-900/40 to-background", accent: "text-destructive" },
];

const STANDARD_PRESETS = [
  { label: "5 / 1", work: 5 },
  { label: "10 / 2", work: 10 },
  { label: "15 / 3", work: 15 },
  { label: "25 / 5", work: 25 },
  { label: "50 / 10", work: 50 },
  { label: "120 / 30", work: 120 },
];

const LONG_BREAK_AFTER = 4;

const Pomodoro = () => {
  const {
    pomoMode, setPomoMode,
    standardWork, setStandardWork,
    customWork, setCustomWork,
    customBreak, setCustomBreak,
    workMin, breakMin, mode, seconds, running, consecutiveWork,
    sessionsToday, studiedTodayMin,
    toggle, reset, skip, addStudyTime,
  } = usePomodoro();

  const [display, setDisplay] = useState<DisplayStyle>("digital");
  const [themeIdx, setThemeIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Free-form stopwatch (count-up)
  const [swRunning, setSwRunning] = useState(false);
  const [swSeconds, setSwSeconds] = useState(0);
  const swSavedMinRef = useRef(0);
  useEffect(() => {
    if (!swRunning) return;
    const id = window.setInterval(() => setSwSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [swRunning]);
  useEffect(() => {
    if (!swRunning) return;
    const totalMin = Math.floor(swSeconds / 60);
    const delta = totalMin - swSavedMinRef.current;
    if (delta >= 1) {
      swSavedMinRef.current = totalMin;
      addStudyTime(delta, false); // partial — adds to total time, no session bump
    }
  }, [swSeconds, swRunning, addStudyTime]);
  const stopStopwatch = async () => {
    setSwRunning(false);
    const totalMin = Math.floor(swSeconds / 60);
    const delta = totalMin - swSavedMinRef.current;
    if (delta >= 1) await addStudyTime(delta, false);
    if (totalMin >= 1) toast.success(`Stopwatch saved · ${totalMin} min added`);
    swSavedMinRef.current = 0;
    setSwSeconds(0);
  };

  // Manual session entry
  const [manualMin, setManualMin] = useState<string>("");
  const submitManual = async () => {
    const n = parseInt(manualMin, 10);
    if (!n || n <= 0) {
      toast.error("Enter minutes greater than 0");
      return;
    }
    await addStudyTime(n, true);
    setManualMin("");
  };

  const totalSeconds = mode === "work" ? workMin * 60 : breakMin * 60;
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100;

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const theme = themes[themeIdx];
  const studiedTodayHrs = Math.round((studiedTodayMin / 60) * 10) / 10;

  const renderAnalog = () => {
    const minuteAngle = ((totalSeconds - seconds) / totalSeconds) * 360;
    const elapsedInMinute = 60 - (seconds % 60);
    const secondAngle = ((elapsedInMinute % 60) / 60) * 360;
    const cx = 50, cy = 50;

    return (
      <div className="relative w-56 h-56 sm:w-72 sm:h-72">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx={cx} cy={cy} r="48" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" opacity="0.3" />
          <circle cx={cx} cy={cy} r="47" fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r="44" fill="hsl(var(--card))" opacity="0.6" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const outerR = 42, innerR = i % 3 === 0 ? 37 : 39;
            return (
              <line key={`h-${i}`} x1={cx + outerR * Math.cos(angle)} y1={cy + outerR * Math.sin(angle)}
                x2={cx + innerR * Math.cos(angle)} y2={cy + innerR * Math.sin(angle)}
                stroke="hsl(var(--foreground))" strokeWidth={i % 3 === 0 ? "1.2" : "0.5"} strokeLinecap="round" />
            );
          })}
          {Array.from({ length: 60 }).map((_, i) => {
            if (i % 5 === 0) return null;
            const angle = (i * 6 - 90) * (Math.PI / 180);
            return (
              <line key={`m-${i}`} x1={cx + 42 * Math.cos(angle)} y1={cy + 42 * Math.sin(angle)}
                x2={cx + 41 * Math.cos(angle)} y2={cy + 41 * Math.sin(angle)}
                stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" />
            );
          })}
          {[12, 3, 6, 9].map((num) => {
            const i = num === 12 ? 0 : num;
            const angle = (i * 30 - 90) * (Math.PI / 180);
            return (
              <text key={`n-${num}`} x={cx + 34 * Math.cos(angle)} y={cy + 34 * Math.sin(angle)}
                textAnchor="middle" dominantBaseline="central"
                fill="hsl(var(--foreground))" fontSize="4" fontWeight="bold" fontFamily="sans-serif">
                {num}
              </text>
            );
          })}
          <circle cx={cx} cy={cy} r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
            strokeLinecap="round" className="transition-all duration-1000"
            transform={`rotate(-90 ${cx} ${cy})`} opacity="0.4" />
          {(() => {
            const angle = (minuteAngle - 90) * (Math.PI / 180);
            return <line x1={cx} y1={cy} x2={cx + 28 * Math.cos(angle)} y2={cy + 28 * Math.sin(angle)}
              stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" className="transition-all duration-1000" />;
          })()}
          {(() => {
            const angle = (secondAngle - 90) * (Math.PI / 180);
            return (
              <>
                <line x1={cx - 8 * Math.cos(angle)} y1={cy - 8 * Math.sin(angle)}
                  x2={cx + 32 * Math.cos(angle)} y2={cy + 32 * Math.sin(angle)}
                  stroke="hsl(var(--destructive))" strokeWidth="0.5" strokeLinecap="round" />
                <circle cx={cx} cy={cy} r="1.5" fill="hsl(var(--destructive))" />
              </>
            );
          })()}
          <circle cx={cx} cy={cy} r="2" fill="hsl(var(--foreground))" />
          <circle cx={cx} cy={cy} r="1" fill="hsl(var(--background))" />
        </svg>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <span className={`font-heading text-base sm:text-lg font-bold ${theme.accent} tabular-nums`}>{formatTime(seconds)}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-2">{mode}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 sm:space-y-6 min-h-[calc(100vh-2rem)] bg-gradient-to-b ${theme.bg} -m-6 p-4 sm:p-6 rounded-xl transition-colors duration-500`}>
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
            <Timer className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Pomodoro
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {pomoMode === "standard" ? `${workMin}m work · ${breakMin}m break` : `Custom: ${workMin}m work · ${breakMin}m break`}
            <span className="ml-2 text-primary font-medium">{sessionsToday} sessions today</span>
          </p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex gap-2 animate-fade-in">
        <button
          onClick={() => setPomoMode("standard")}
          className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${pomoMode === "standard" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
        >
          Standard
        </button>
        <button
          onClick={() => setPomoMode("custom")}
          className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${pomoMode === "custom" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
        >
          Custom
        </button>
      </div>

      {pomoMode === "standard" ? (
        <div className="glass-card p-3 sm:p-4 animate-fade-in">
          <label className="text-xs text-muted-foreground block mb-2">Preset (work / break)</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STANDARD_PRESETS.map((p) => (
              <button
                key={p.work}
                onClick={() => { if (!running) setStandardWork(p.work); }}
                className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-medium transition-all ${standardWork === p.work ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        showSettings && (
          <div className="glass-card p-3 sm:p-4 grid grid-cols-2 gap-3 sm:gap-4 animate-scale-in">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Work (min)</label>
              <input type="number" value={customWork} min={1} onChange={(e) => setCustomWork(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Break (min)</label>
              <input type="number" value={customBreak} min={1} onChange={(e) => setCustomBreak(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
        )
      )}

      {showSettings && (
        <div className="glass-card p-3 sm:p-4 grid grid-cols-2 gap-3 sm:gap-4 animate-scale-in">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Display</label>
            <select value={display} onChange={(e) => setDisplay(e.target.value as DisplayStyle)}
              className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="digital">Digital</option>
              <option value="analog">Analog</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Theme</label>
            <div className="flex gap-2 mt-1">
              {themes.map((t, i) => (
                <button key={t.name} onClick={() => setThemeIdx(i)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${t.bg} border-2 ${i === themeIdx ? "border-primary" : "border-transparent"}`} title={t.name} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-6 sm:py-12 animate-fade-in">
        {display === "analog" ? renderAnalog() : (
          <div className="text-center">
            <span className={`font-heading ${display === "minimal" ? "text-5xl sm:text-7xl" : "text-6xl sm:text-8xl"} font-bold ${theme.accent} tabular-nums tracking-tight`}>
              {formatTime(seconds)}
            </span>
            <p className="text-muted-foreground text-xs sm:text-sm uppercase tracking-widest mt-2 sm:mt-3">
              {mode === "work" ? "Focus Time" : "Break Time"}
              {mode === "break" && consecutiveWork > 0 && consecutiveWork % LONG_BREAK_AFTER === 0 && " (Long Break)"}
            </p>
            {display === "digital" && (
              <div className="w-48 sm:w-64 h-1.5 bg-muted rounded-full overflow-hidden mt-3 sm:mt-4 mx-auto">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4 mt-6 sm:mt-8">
          <button onClick={reset} className="p-2.5 sm:p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
          </button>
          <button
            onClick={toggle}
            className="p-4 sm:p-5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity animate-pulse-glow"
          >
            {running ? <Pause className="w-6 h-6 sm:w-7 sm:h-7" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" />}
          </button>
          <button
            onClick={skip}
            className="px-3 sm:px-4 py-2 rounded-full bg-secondary text-xs sm:text-sm text-foreground hover:bg-secondary/80 transition-colors"
          >
            {mode === "work" ? "Skip to Break" : "Skip to Work"}
          </button>
        </div>
      </div>

      <div className="glass-card p-3 sm:p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-foreground">Today's Study</span>
          </div>
          <span className="text-xs sm:text-sm text-primary font-semibold">{studiedTodayHrs} hrs</span>
        </div>
        <div className="w-full h-2 sm:h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (studiedTodayMin / (workMin * 12)) * 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{sessionsToday} sessions · {studiedTodayMin} minutes total</p>
      </div>
    </div>
  );
};

export default Pomodoro;
