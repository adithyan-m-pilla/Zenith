import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type TimerMode = "work" | "break";
export type PomodoroMode = "standard" | "custom";

const LONG_BREAK_AFTER = 4;
const LONG_BREAK_MIN = 15;
const TIMER_KEY = "zenith-pomodoro-timer";

export function getStandardBreak(workMin: number): number {
  return Math.max(1, Math.round(workMin / 5));
}

interface PersistState {
  endTime: number;
  mode: TimerMode;
  workMin: number;
  breakMin: number;
  pomoMode: PomodoroMode;
  consecutiveWork: number;
  standardWork: number;
  customWork: number;
  customBreak: number;
}

function loadState(): PersistState | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistState;
  } catch {
    return null;
  }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume().then(() => {
      const beep = (f: number, t: number, d: number) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = f;
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + d);
        o.start(t); o.stop(t + d);
      };
      beep(800, ctx.currentTime, 0.2);
      beep(1000, ctx.currentTime + 0.25, 0.2);
      beep(800, ctx.currentTime + 0.5, 0.3);
    });
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Zenith Timer", { body: "Your timer has finished!" });
    }
  } catch {}
}

interface PomodoroCtx {
  pomoMode: PomodoroMode;
  setPomoMode: (m: PomodoroMode) => void;
  standardWork: number;
  setStandardWork: (n: number) => void;
  customWork: number;
  setCustomWork: (n: number) => void;
  customBreak: number;
  setCustomBreak: (n: number) => void;
  workMin: number;
  breakMin: number;
  mode: TimerMode;
  seconds: number;
  running: boolean;
  consecutiveWork: number;
  sessionsToday: number;
  studiedTodayMin: number;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skip: () => void;
}

const Ctx = createContext<PomodoroCtx | null>(null);

export const PomodoroProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const saved = useRef(loadState());

  const [pomoMode, setPomoMode] = useState<PomodoroMode>(saved.current?.pomoMode ?? "standard");
  const [standardWork, setStandardWork] = useState(saved.current?.standardWork ?? 25);
  const [customWork, setCustomWork] = useState(saved.current?.customWork ?? 25);
  const [customBreak, setCustomBreak] = useState(saved.current?.customBreak ?? 5);

  const workMin = pomoMode === "standard" ? standardWork : customWork;
  const breakMin = pomoMode === "standard" ? getStandardBreak(standardWork) : customBreak;

  const [mode, setMode] = useState<TimerMode>(saved.current?.mode ?? "work");
  const [consecutiveWork, setConsecutiveWork] = useState(saved.current?.consecutiveWork ?? 0);

  const initialRunning = !!saved.current && saved.current.endTime > Date.now();
  const [endTime, setEndTime] = useState<number | null>(initialRunning ? saved.current!.endTime : null);
  const [seconds, setSeconds] = useState(() => {
    if (initialRunning) return Math.max(0, Math.ceil((saved.current!.endTime - Date.now()) / 1000));
    return (saved.current?.mode === "break" ? breakMin : workMin) * 60;
  });

  const [sessionsToday, setSessionsToday] = useState(0);
  const [studiedTodayMin, setStudiedTodayMin] = useState(0);

  const running = endTime !== null;

  // Persist state on changes
  useEffect(() => {
    if (endTime !== null) {
      const state: PersistState = {
        endTime, mode, workMin, breakMin, pomoMode, consecutiveWork,
        standardWork, customWork, customBreak,
      };
      localStorage.setItem(TIMER_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(TIMER_KEY);
    }
  }, [endTime, mode, workMin, breakMin, pomoMode, consecutiveWork, standardWork, customWork, customBreak]);

  // When not running and durations change, sync seconds
  useEffect(() => {
    if (endTime === null) {
      setSeconds((mode === "work" ? workMin : breakMin) * 60);
    }
  }, [workMin, breakMin, mode, endTime]);

  const saveSession = useCallback(async (minutes: number) => {
    if (!user || minutes <= 0) return;
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject: "Pomodoro",
      duration_minutes: minutes,
      session_type: pomoMode,
    });
    if (!error) {
      setSessionsToday((c) => c + 1);
      setStudiedTodayMin((c) => c + minutes);
      toast.success(`Session saved! ${minutes} min recorded.`);
    }
  }, [user, pomoMode]);

  // Global tick - runs as long as provider is mounted (entire app)
  useEffect(() => {
    if (endTime === null) return;

    const tick = () => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        playNotificationSound();
        if (mode === "work") {
          saveSession(workMin);
          const next = consecutiveWork + 1;
          setConsecutiveWork(next);
          const isLong = next % LONG_BREAK_AFTER === 0;
          const nb = isLong ? LONG_BREAK_MIN : breakMin;
          setMode("break");
          setSeconds(nb * 60);
          setEndTime(Date.now() + nb * 60 * 1000);
          toast.success(isLong ? "🎉 Long break time!" : "☕ Break time!");
        } else {
          setMode("work");
          setSeconds(workMin * 60);
          setEndTime(Date.now() + workMin * 60 * 1000);
          toast.success("💪 Back to work!");
        }
      } else {
        setSeconds(remaining);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endTime, mode, workMin, breakMin, consecutiveWork, saveSession]);

  // Load today's totals
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

  // Notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Save partial work time when interrupting an in-progress work session
  const savePartialIfWork = () => {
    if (mode !== "work" || endTime === null) return;
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    const elapsedSec = workMin * 60 - remaining;
    const minutes = Math.round(elapsedSec / 60);
    if (minutes >= 1) saveSession(minutes);
  };

  const start = () => setEndTime(Date.now() + seconds * 1000);
  const pause = () => {
    savePartialIfWork();
    setEndTime(null);
  };
  const toggle = () => (running ? pause() : start());
  const reset = () => {
    savePartialIfWork();
    setEndTime(null);
    setSeconds((mode === "work" ? workMin : breakMin) * 60);
  };
  const skip = () => {
    savePartialIfWork();
    const next: TimerMode = mode === "work" ? "break" : "work";
    setMode(next);
    setSeconds((next === "work" ? workMin : breakMin) * 60);
    setEndTime(null);
  };

  return (
    <Ctx.Provider value={{
      pomoMode, setPomoMode,
      standardWork, setStandardWork,
      customWork, setCustomWork,
      customBreak, setCustomBreak,
      workMin, breakMin, mode, seconds, running, consecutiveWork,
      sessionsToday, studiedTodayMin,
      start, pause, toggle, reset, skip,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const usePomodoro = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePomodoro must be used inside PomodoroProvider");
  return v;
};
