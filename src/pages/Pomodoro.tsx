import { useEffect, useRef, useState } from "react";
import { Timer, Play, Pause, RotateCcw, Settings, StopCircle, Plus, Target, Maximize2, Minimize2, Image as ImageIcon, X } from "lucide-react";
import { usePomodoro } from "@/contexts/PomodoroContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DisplayStyle = "digital" | "analog" | "minimal";
type TopTab = "standard" | "custom" | "stopwatch";

// Themes built from semantic tokens so they shift with the global app theme.
const themes = [
  { name: "Primary", bg: "from-primary/15 to-background", accent: "text-primary" },
  { name: "Info",    bg: "from-info/15 to-background",    accent: "text-info" },
  { name: "Warning", bg: "from-warning/15 to-background", accent: "text-warning" },
  { name: "Rose",    bg: "from-destructive/15 to-background", accent: "text-destructive" },
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
const BG_KEY = "zenith-pomodoro-bg";

const Pomodoro = () => {
  const {
    pomoMode, setPomoMode,
    standardWork, setStandardWork,
    customWork, setCustomWork,
    customBreak, setCustomBreak,
    workMin, breakMin, mode, seconds, running, consecutiveWork,
    sessionsToday,
    toggle, reset, skip, addStudyTime,
    swSeconds, swRunning, startStopwatch, pauseStopwatch, stopStopwatch,
  } = usePomodoro();
  const { user } = useAuth();

  // Selects a standard preset: if currently running, save partial then reset to new duration
  const selectPreset = (work: number) => {
    if (standardWork === work) return; // already selected
    if (running) reset(); // saves any partial work time, then stops & resets
    setStandardWork(work);
  };

  const [tab, setTab] = useState<TopTab>(pomoMode === "custom" ? "custom" : "standard");
  useEffect(() => {
    if (tab === "standard") setPomoMode("standard");
    else if (tab === "custom") setPomoMode("custom");
    // Stopwatch tab: leave pomoMode untouched. Switching tabs no longer pauses
    // the stopwatch — it keeps running in the background.
  }, [tab, setPomoMode]);

  const [display, setDisplay] = useState<DisplayStyle>("digital");
  const [themeIdx, setThemeIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Fullscreen
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await rootRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  };

  // Background image (URL stored in localStorage)
  const [bgUrl, setBgUrl] = useState<string>(() => localStorage.getItem(BG_KEY) || "");
  useEffect(() => {
    if (bgUrl) localStorage.setItem(BG_KEY, bgUrl);
    else localStorage.removeItem(BG_KEY);
  }, [bgUrl]);
  const onBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setBgUrl(String(reader.result || ""));
    reader.readAsDataURL(f);
  };

  // Daily goal from profile
  const [dailyGoalMin, setDailyGoalMin] = useState<number>(0);
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("daily_goal_hours").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const hrs = Number(data?.daily_goal_hours ?? 0);
        if (hrs > 0) setDailyGoalMin(Math.round(hrs * 60));
      });
  }, [user]);
  const sessionsToGoal = dailyGoalMin > 0 ? Math.ceil(dailyGoalMin / Math.max(1, workMin)) : 0;

  // Manual session entry
  const [manualMin, setManualMin] = useState<string>("");
  const submitManual = async () => {
    const n = parseInt(manualMin, 10);
    if (!n || n <= 0) { toast.error("Enter minutes greater than 0"); return; }
    await addStudyTime(n, true);
    setManualMin("");
  };

  const isStopwatch = tab === "stopwatch";
  const displaySec = isStopwatch ? swSeconds : seconds;
  const totalSeconds = isStopwatch ? Math.max(60, swSeconds + 1) : (mode === "work" ? workMin * 60 : breakMin * 60);
  const progress = isStopwatch ? 0 : ((totalSeconds - seconds) / totalSeconds) * 100;
  const isRunning = isStopwatch ? swRunning : running;

  const formatTime = (s: number) => {
    const hr = Math.floor(s / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (hr > 0) return `${hr}:${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const theme = themes[themeIdx];

  const renderAnalog = () => {
    const cx = 50, cy = 50;
    const minuteAngle = isStopwatch
      ? ((swSeconds / 60) % 60) * 6
      : ((totalSeconds - seconds) / totalSeconds) * 360;
    const secondAngle = isStopwatch
      ? (swSeconds % 60) * 6
      : (((60 - (seconds % 60)) % 60) / 60) * 360;
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
          {!isStopwatch && (
            <circle cx={cx} cy={cy} r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="2"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
              strokeLinecap="round" className="transition-all duration-1000"
              transform={`rotate(-90 ${cx} ${cy})`} opacity="0.4" />
          )}
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
        </svg>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <span className={`font-heading text-base sm:text-lg font-bold ${theme.accent} tabular-nums`}>{formatTime(displaySec)}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider ml-2">{isStopwatch ? "stopwatch" : mode}</span>
        </div>
      </div>
    );
  };

  const bgStyle: React.CSSProperties = bgUrl
    ? { backgroundImage: `linear-gradient(hsl(var(--background)/0.75), hsl(var(--background)/0.85)), url(${bgUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  return (
    <div
      ref={rootRef}
      style={bgStyle}
      className={`space-y-4 sm:space-y-6 min-h-[calc(100vh-2rem)] ${bgUrl ? "" : `bg-gradient-to-b ${theme.bg}`} -m-6 p-4 sm:p-6 rounded-xl transition-colors duration-500`}
    >
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
            <Timer className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> {isStopwatch ? "Stopwatch" : "Pomodoro"}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {isStopwatch ? "Free-form count-up · auto-saves every minute" : `${workMin}m work · ${breakMin}m break`}
            <span className="ml-2 text-primary font-medium">{sessionsToday} sessions today</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleFullscreen} title="Fullscreen" className="p-2 rounded-lg hover:bg-secondary transition-colors">
            {isFullscreen ? <Minimize2 className="w-5 h-5 text-muted-foreground" /> : <Maximize2 className="w-5 h-5 text-muted-foreground" />}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 animate-fade-in">
        {(["standard", "custom", "stopwatch"] as TopTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 sm:py-2.5 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "standard" && (
        <div className="glass-card p-3 sm:p-4 animate-fade-in">
          <label className="text-xs text-muted-foreground block mb-2">Preset (work / break)</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STANDARD_PRESETS.map((p) => (
              <button
                key={p.work}
                onClick={() => selectPreset(p.work)}
                title={running && standardWork !== p.work ? "Resets current session and starts new preset" : undefined}
                className={`py-2 px-2 sm:px-3 rounded-lg text-xs font-medium transition-all ${
                  standardWork === p.work
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                    : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "custom" && showSettings && (
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
      )}

      {showSettings && (
        <div className="glass-card p-3 sm:p-4 space-y-3 sm:space-y-4 animate-scale-in">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
              <label className="text-xs text-muted-foreground block mb-1">Accent</label>
              <div className="flex gap-2 mt-1">
                {themes.map((t, i) => (
                  <button key={t.name} onClick={() => setThemeIdx(i)} className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br ${t.bg} border-2 ${i === themeIdx ? "border-primary" : "border-transparent"}`} title={t.name} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> Background image
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={bgUrl}
                onChange={(e) => setBgUrl(e.target.value)}
                placeholder="Paste image URL…"
                className="flex-1 bg-secondary rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <label className="px-3 py-2 rounded-lg bg-secondary text-xs cursor-pointer hover:bg-secondary/80">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={onBgFile} />
              </label>
              {bgUrl && (
                <button onClick={() => setBgUrl("")} className="p-2 rounded-lg bg-secondary hover:bg-destructive/20" title="Remove">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center py-6 sm:py-12 animate-fade-in">
        {display === "analog" ? renderAnalog() : (
          <div className="text-center">
            <span className={`font-heading ${display === "minimal" ? "text-5xl sm:text-7xl" : "text-6xl sm:text-8xl"} font-bold ${theme.accent} tabular-nums tracking-tight`}>
              {formatTime(displaySec)}
            </span>
            <p className="text-muted-foreground text-xs sm:text-sm uppercase tracking-widest mt-2 sm:mt-3">
              {isStopwatch ? "Elapsed Time" : (mode === "work" ? "Focus Time" : "Break Time")}
              {!isStopwatch && mode === "break" && consecutiveWork > 0 && consecutiveWork % LONG_BREAK_AFTER === 0 && " (Long Break)"}
            </p>
            {display === "digital" && !isStopwatch && (
              <div className="w-48 sm:w-64 h-1.5 bg-muted rounded-full overflow-hidden mt-3 sm:mt-4 mx-auto">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 sm:gap-4 mt-6 sm:mt-8">
          {isStopwatch ? (
            <>
              <button
                onClick={() => (swRunning ? pauseStopwatch() : startStopwatch())}
                className="p-4 sm:p-5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity animate-pulse-glow"
              >
                {swRunning ? <Pause className="w-6 h-6 sm:w-7 sm:h-7" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" />}
              </button>
              <button
                onClick={stopStopwatch}
                disabled={swSeconds === 0 && !swRunning}
                className="px-3 sm:px-4 py-2 rounded-full bg-secondary text-xs sm:text-sm text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                <StopCircle className="w-4 h-4" /> Stop & reset
              </button>
            </>
          ) : (
            <>
              <button onClick={reset} className="p-2.5 sm:p-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
              </button>
              <button
                onClick={toggle}
                className="p-4 sm:p-5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity animate-pulse-glow"
              >
                {isRunning ? <Pause className="w-6 h-6 sm:w-7 sm:h-7" /> : <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5" />}
              </button>
              <button
                onClick={skip}
                className="px-3 sm:px-4 py-2 rounded-full bg-secondary text-xs sm:text-sm text-foreground hover:bg-secondary/80 transition-colors"
              >
                {mode === "work" ? "Skip to Break" : "Skip to Work"}
              </button>
            </>
          )}
        </div>
      </div>

      {!isStopwatch && (
        <div className="glass-card p-3 sm:p-4 animate-fade-in flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            {dailyGoalMin > 0 ? (
              <>
                <p className="text-xs sm:text-sm font-medium text-foreground">
                  <span className="text-primary font-bold">{sessionsToGoal}</span>{" "}
                  {sessionsToGoal === 1 ? "session" : "sessions"} of {workMin}m to hit your daily goal
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Goal: {dailyGoalMin} min · {sessionsToday} done today</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Set your daily goal in the sidebar to see how many sessions you need.</p>
            )}
          </div>
        </div>
      )}

      <div className="glass-card p-3 sm:p-4 animate-fade-in">
        <p className="text-xs sm:text-sm font-medium text-foreground mb-1">Add your session</p>
        <p className="text-[10px] text-muted-foreground mb-3">Log time you studied offline or away from the app</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={manualMin}
            onChange={(e) => setManualMin(e.target.value)}
            placeholder="Minutes studied"
            className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={submitManual}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pomodoro;
