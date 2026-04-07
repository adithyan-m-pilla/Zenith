import { useState, useEffect, useRef, useCallback } from "react";
import { Timer, Play, Pause, RotateCcw, Settings, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type TimerMode = "work" | "break";
type PomodoroMode = "standard" | "custom";
type DisplayStyle = "digital" | "analog" | "minimal";

const themes = [
  { name: "Emerald", bg: "from-emerald-900/40 to-background", accent: "text-primary" },
  { name: "Ocean", bg: "from-blue-900/40 to-background", accent: "text-info" },
  { name: "Sunset", bg: "from-amber-900/40 to-background", accent: "text-warning" },
  { name: "Rose", bg: "from-rose-900/40 to-background", accent: "text-destructive" },
];

function getStandardBreak(workMin: number): number {
  return Math.max(1, Math.round(workMin / 5));
}

const STANDARD_PRESETS = [
  { label: "5 / 1", work: 5 },
  { label: "10 / 2", work: 10 },
  { label: "15 / 3", work: 15 },
  { label: "25 / 5", work: 25 },
  { label: "50 / 10", work: 50 },
  { label: "120 / 30", work: 120 },
];

const LONG_BREAK_AFTER = 4; // sessions before long break
const LONG_BREAK_MIN = 15;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playBeep = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    playBeep(800, ctx.currentTime, 0.2);
    playBeep(1000, ctx.currentTime + 0.25, 0.2);
    playBeep(800, ctx.currentTime + 0.5, 0.3);
  } catch {}
}

// Persist timer state in localStorage
const TIMER_KEY = "zenith-pomodoro-timer";

interface TimerState {
  endTime: number;
  mode: TimerMode;
  workMin: number;
  breakMin: number;
  pomoMode: PomodoroMode;
  consecutiveWork: number;
}

function saveTimerState(state: TimerState | null) {
  if (state) localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  else localStorage.removeItem(TIMER_KEY);
}

function loadTimerState(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as TimerState;
    if (state.endTime <= Date.now()) return null;
    return state;
  } catch { return null; }
}

const Pomodoro = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const savedState = useRef(loadTimerState());

  const [pomoMode, setPomoMode] = useState<PomodoroMode>(savedState.current?.pomoMode ?? "standard");
  const [standardWork, setStandardWork] = useState(25);
  const [customWork, setCustomWork] = useState(25);
  const [customBreak, setCustomBreak] = useState(5);

  const workMin = pomoMode === "standard" ? standardWork : customWork;
  const breakMin = pomoMode === "standard" ? getStandardBreak(standardWork) : customBreak;

  const [mode, setMode] = useState<TimerMode>(savedState.current?.mode ?? "work");
  const [seconds, setSeconds] = useState(() => {
    const s = savedState.current;
    if (s) return Math.max(0, Math.ceil((s.endTime - Date.now()) / 1000));
    return workMin * 60;
  });
  const [running, setRunning] = useState(() => !!savedState.current);
  const [display, setDisplay] = useState<DisplayStyle>("digital");
  const [themeIdx, setThemeIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [studiedTodayMin, setStudiedTodayMin] = useState(0);
  const [consecutiveWork, setConsecutiveWork] = useState(savedState.current?.consecutiveWork ?? 0);
  const intervalRef = useRef<number | null>(null);

  // Update seconds when preset changes (only if not running)
  useEffect(() => {
    if (!running) {
      setSeconds(mode === "work" ? workMin * 60 : breakMin * 60);
    }
  }, [workMin, breakMin, pomoMode]);

  const totalSeconds = mode === "work" ? workMin * 60 : breakMin * 60;
  const progress = ((totalSeconds - seconds) / totalSeconds) * 100;

  const saveSession = useCallback(async (durationMinutes: number) => {
    if (!user || durationMinutes <= 0) return;
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject: "Pomodoro",
      duration_minutes: durationMinutes,
      session_type: pomoMode,
    });
    if (!error) {
      setSessionsToday((c) => c + 1);
      setStudiedTodayMin((c) => c + durationMinutes);
      toast({ title: "Session saved!", description: `${durationMinutes} min study session recorded.` });
    }
  }, [user, pomoMode, toast]);

  // Main timer loop
  useEffect(() => {
    if (running) {
      // Save state to localStorage
      saveTimerState({
        endTime: Date.now() + seconds * 1000,
        mode,
        workMin,
        breakMin,
        pomoMode,
        consecutiveWork,
      });

      intervalRef.current = window.setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            // Timer finished
            playNotificationSound();

            if (mode === "work") {
              saveSession(workMin);
              const newConsecutive = consecutiveWork + 1;
              setConsecutiveWork(newConsecutive);

              // Check for long break
              const isLongBreak = newConsecutive > 0 && newConsecutive % LONG_BREAK_AFTER === 0;
              const nextBreak = isLongBreak ? LONG_BREAK_MIN : breakMin;

              setMode("break");
              toast({
                title: isLongBreak ? "🎉 Long break time!" : "☕ Break time!",
                description: `Take a ${nextBreak} minute break.`,
              });

              // Save new state
              saveTimerState({
                endTime: Date.now() + nextBreak * 60 * 1000,
                mode: "break",
                workMin,
                breakMin: nextBreak,
                pomoMode,
                consecutiveWork: newConsecutive,
              });

              return nextBreak * 60;
            } else {
              // Break finished, auto-start work
              setMode("work");
              toast({ title: "💪 Back to work!", description: `Starting ${workMin} minute focus session.` });

              saveTimerState({
                endTime: Date.now() + workMin * 60 * 1000,
                mode: "work",
                workMin,
                breakMin,
                pomoMode,
                consecutiveWork,
              });

              return workMin * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      saveTimerState(null);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, mode, workMin, breakMin, pomoMode, consecutiveWork, saveSession, toast]);

  // Load today's session count and total minutes
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    supabase
      .from("study_sessions")
      .select("id, duration_minutes")
      .eq("user_id", user.id)
      .gte("completed_at", today.toISOString())
      .then(({ data }) => {
        setSessionsToday(data?.length ?? 0);
        setStudiedTodayMin((data || []).reduce((a, s) => a + (s.duration_minutes || 0), 0));
      });
  }, [user]);

  const reset = () => {
    setRunning(false);
    saveTimerState(null);
    setSeconds(mode === "work" ? workMin * 60 : breakMin * 60);
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const theme = themes[themeIdx];
  const studiedTodayHrs = Math.round((studiedTodayMin / 60) * 10) / 10;

  const renderAnalog = () => {
    // Fix: minute hand goes clockwise as time progresses
    const minuteAngle = ((totalSeconds - seconds) / totalSeconds) * 360;
    // Fix: second hand goes clockwise - use elapsed seconds within the minute
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
          onClick={() => { setPomoMode("standard"); if (!running) { setMode("work"); } }}
          className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${pomoMode === "standard" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
        >
          Standard
        </button>
        <button
          onClick={() => { setPomoMode("custom"); if (!running) { setMode("work"); } }}
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
                onClick={() => { if (!running) { setStandardWork(p.work); setMode("work"); } }}
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
              <input type="number" value={customWork} onChange={(e) => { setCustomWork(+e.target.value); if (!running) setMode("work"); }}
                className="w-full bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Break (min)</label>
              <input type="number" value={customBreak} onChange={(e) => setCustomBreak(+e.target.value)}
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
            onClick={() => setRunning(!running)}
            className="p-4 sm:p-5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity animate-pulse-glow"
          >
            {running ? <Pause className="w-6 h-6 sm:w-7 sm:h-7" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" />}
          </button>
          <button
            onClick={() => {
              const nextMode = mode === "work" ? "break" : "work";
              setMode(nextMode);
              setSeconds(nextMode === "work" ? workMin * 60 : breakMin * 60);
              setRunning(false);
              saveTimerState(null);
            }}
            className="px-3 sm:px-4 py-2 rounded-full bg-secondary text-xs sm:text-sm text-foreground hover:bg-secondary/80 transition-colors"
          >
            {mode === "work" ? "Skip to Break" : "Skip to Work"}
          </button>
        </div>
      </div>

      {/* Total hours studied today bar */}
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
