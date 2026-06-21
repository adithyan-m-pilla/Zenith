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

  // Track minutes already saved for the current work session, so we never double-count
  const savedMinutesRef = useRef(0);
  // Refs for use inside unload listeners (which capture state once)
  const stateRef = useRef({ mode, endTime, workMin, userId: user?.id as string | undefined });
  stateRef.current = { mode, endTime, workMin, userId: user?.id };

  const running = endTime !== null;

  // Reset saved-minutes counter whenever a new work session begins
  useEffect(() => {
    if (mode === "work" && endTime !== null) {
      const fullSec = workMin * 60;
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      // If timer was just (re)started from full, reset counter
      if (fullSec - remaining < 2) savedMinutesRef.current = 0;
    }
    if (mode !== "work") savedMinutesRef.current = 0;
  }, [mode, endTime, workMin]);

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

  // When not running and durations/mode change, sync seconds to full duration.
  // Important: do NOT reset on pause — preserve the remaining time so resume continues.
  const prevDurRef = useRef({ workMin, breakMin, mode });
  useEffect(() => {
    if (endTime !== null) {
      prevDurRef.current = { workMin, breakMin, mode };
      return;
    }
    const prev = prevDurRef.current;
    const changed = prev.workMin !== workMin || prev.breakMin !== breakMin || prev.mode !== mode;
    if (changed) {
      setSeconds((mode === "work" ? workMin : breakMin) * 60);
    }
    prevDurRef.current = { workMin, breakMin, mode };
  }, [workMin, breakMin, mode, endTime]);

  // Broadcast studying status to profile so friends can see online/offline-style indicator
  useEffect(() => {
    if (!user) return;
    const studying = endTime !== null && mode === "work";
    supabase
      .from("profiles")
      .update({ is_studying: studying, studying_since: studying ? new Date().toISOString() : null })
      .eq("user_id", user.id)
      .then(() => {});
  }, [user, endTime, mode]);

  const saveSession = useCallback(async (minutes: number, isCompletion = false) => {
    if (!user || minutes <= 0) return;
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject: "Pomodoro",
      duration_minutes: minutes,
      session_type: isCompletion ? pomoMode : `${pomoMode}_partial`,
    });
    if (!error) {
      if (isCompletion) setSessionsToday((c) => c + 1);
      setStudiedTodayMin((c) => c + minutes);
      if (isCompletion) toast.success(`Session complete! ${minutes} min recorded.`);
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
          const remainingMin = Math.max(0, workMin - savedMinutesRef.current);
          if (remainingMin > 0) saveSession(remainingMin, true);
          else {
            // Already saved all minutes via partials, but still count as a completed session
            setSessionsToday((c) => c + 1);
            toast.success(`Session complete!`);
          }
          savedMinutesRef.current = 0;
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
    const totalMinutes = Math.round(elapsedSec / 60);
    const delta = totalMinutes - savedMinutesRef.current;
    if (delta >= 1) {
      savedMinutesRef.current = totalMinutes;
      saveSession(delta);
    }
  };

  // Auto-save partial progress every minute, even if user never pauses
  useEffect(() => {
    if (endTime === null || mode !== "work") return;
    const id = window.setInterval(() => savePartialIfWork(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime, mode, workMin]);

  // On tab close / refresh: save remaining partial work time via keepalive fetch
  useEffect(() => {
    const flush = () => {
      const { mode: m, endTime: et, workMin: wm, userId } = stateRef.current;
      if (!userId || m !== "work" || et === null) return;
      const remaining = Math.max(0, Math.ceil((et - Date.now()) / 1000));
      const elapsedSec = wm * 60 - remaining;
      const totalMinutes = Math.round(elapsedSec / 60);
      const delta = totalMinutes - savedMinutesRef.current;
      if (delta < 1) return;
      savedMinutesRef.current = totalMinutes;
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/study_sessions`;
        const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const session = (supabase.auth as any).currentSession?.() ?? null;
        // Fallback to localStorage-stored token
        let token = apikey;
        try {
          const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
          if (keys[0]) {
            const parsed = JSON.parse(localStorage.getItem(keys[0]) || "{}");
            if (parsed?.access_token) token = parsed.access_token;
          }
        } catch {}
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey,
            Authorization: `Bearer ${token}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            user_id: userId,
            subject: "Pomodoro",
            duration_minutes: delta,
            session_type: pomoMode,
          }),
        }).catch(() => {});
      } catch {}
    };
    const onHide = () => flush();
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pomoMode]);

  const start = () => {
    // Only reset saved-minutes counter when starting a fresh session (not resuming a paused one)
    const fullSec = (mode === "work" ? workMin : breakMin) * 60;
    if (seconds >= fullSec) savedMinutesRef.current = 0;
    setEndTime(Date.now() + seconds * 1000);
  };
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
