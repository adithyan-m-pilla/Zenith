import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw, Settings } from "lucide-react";

type TimerMode = "work" | "break";
type DisplayStyle = "digital" | "analog" | "minimal";

const themes = [
  { name: "Emerald", bg: "from-emerald-900/40 to-background", accent: "text-primary" },
  { name: "Ocean", bg: "from-blue-900/40 to-background", accent: "text-info" },
  { name: "Sunset", bg: "from-amber-900/40 to-background", accent: "text-warning" },
  { name: "Rose", bg: "from-rose-900/40 to-background", accent: "text-destructive" },
];

const Pomodoro = () => {
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [mode, setMode] = useState<TimerMode>("work");
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState<DisplayStyle>("digital");
  const [themeIdx, setThemeIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const totalSeconds = mode === "work" ? workMin * 60 : breakMin * 60;
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100;

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setRunning(false);
            setMode((m) => (m === "work" ? "break" : "work"));
            return m => (mode === "work" ? breakMin : workMin) * 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode, workMin, breakMin]);

  const reset = () => {
    setRunning(false);
    setSeconds(mode === "work" ? workMin * 60 : breakMin * 60);
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const theme = themes[themeIdx];

  const renderAnalog = () => {
    const angle = (progress / 100) * 360;
    return (
      <div className="relative w-64 h-64">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--primary))" strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-heading text-4xl font-bold ${theme.accent}`}>{formatTime(seconds)}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{mode}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 min-h-[calc(100vh-2rem)] bg-gradient-to-b ${theme.bg} -m-6 p-6 rounded-xl transition-colors duration-500`}>
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
            <Timer className="w-8 h-8 text-primary" /> Pomodoro
          </h1>
          <p className="text-muted-foreground mt-1">Focus sessions with customizable timers</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {showSettings && (
        <div className="glass-card p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 animate-scale-in">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Work (min)</label>
            <input type="number" value={workMin} onChange={(e) => { setWorkMin(+e.target.value); if (!running) setSeconds(+e.target.value * 60); }} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Break (min)</label>
            <input type="number" value={breakMin} onChange={(e) => setBreakMin(+e.target.value)} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Display</label>
            <select value={display} onChange={(e) => setDisplay(e.target.value as DisplayStyle)} className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="digital">Digital</option>
              <option value="analog">Analog</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Theme</label>
            <div className="flex gap-2 mt-1">
              {themes.map((t, i) => (
                <button key={t.name} onClick={() => setThemeIdx(i)} className={`w-8 h-8 rounded-full bg-gradient-to-br ${t.bg} border-2 ${i === themeIdx ? "border-primary" : "border-transparent"}`} title={t.name} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
        {display === "analog" ? renderAnalog() : (
          <div className="text-center">
            <span className={`font-heading ${display === "minimal" ? "text-7xl" : "text-8xl"} font-bold ${theme.accent} tabular-nums tracking-tight`}>
              {formatTime(seconds)}
            </span>
            <p className="text-muted-foreground text-sm uppercase tracking-widest mt-3">{mode === "work" ? "Focus Time" : "Break Time"}</p>
            {display === "digital" && (
              <div className="w-64 h-1.5 bg-muted rounded-full overflow-hidden mt-4 mx-auto">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 mt-8">
          <button onClick={reset} className="p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
            <RotateCcw className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={() => setRunning(!running)}
            className="p-5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity animate-pulse-glow"
          >
            {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
          </button>
          <button
            onClick={() => { setMode(mode === "work" ? "break" : "work"); setSeconds(mode === "work" ? breakMin * 60 : workMin * 60); setRunning(false); }}
            className="px-4 py-2 rounded-full bg-secondary text-sm text-foreground hover:bg-secondary/80 transition-colors"
          >
            {mode === "work" ? "Skip to Break" : "Skip to Work"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pomodoro;
