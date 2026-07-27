import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type TimerMode = "work" | "break";
export type PomodoroMode = "standard" | "custom";

const LONG_BREAK_AFTER = 4;
const LONG_BREAK_MIN = 15;
const TIMER_KEY = "zenith-pomodoro-timer";
const SETTINGS_KEY = "zenith-pomodoro-settings";
const SW_KEY = "zenith-stopwatch";
const MAX_DAILY_MINUTES = 24 * 60;
const MAX_TIMER_MS = MAX_DAILY_MINUTES * 60 * 1000;

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizeMinutes(value: number, max = MAX_DAILY_MINUTES) {
  return Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
}

function sanitizeTimerMinutes(value: number) {
  return Math.max(1, sanitizeMinutes(value));
}


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

// Persisted separately from timer runtime so settings survive page reload even when paused
interface SettingsState {
  pomoMode: PomodoroMode;
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

function loadSettings(): SettingsState | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SettingsState;
  } catch {
    return null;
  }
}

function saveSettings(s: SettingsState) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
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
  } catch {}
}

function showSystemNotification(title: string, body: string) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      const n = new Notification(title, {
        body,
        icon: "/favicon.png",
        badge: "/favicon.png",
        tag: "zenith-pomodoro",
        requireInteraction: false,
      });
      n.onclick = () => { window.focus(); n.close(); };
    } else if (Notification.permission === "default") {
      Notification.requestPermission();
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
  addStudyTime: (minutes: number, asCompletedSession?: boolean) => Promise<void>;
  // Stopwatch (count-up). Persists across page navigation.
  swSeconds: number;
  swRunning: boolean;
  startStopwatch: () => void;
  pauseStopwatch: () => void;
  stopStopwatch: () => Promise<void>;
}


const Ctx = createContext<PomodoroCtx | null>(null);

export const PomodoroProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const saved = useRef(loadState());
  // Always-persisted settings (survive page reload even when timer is paused)
  const savedSettings = useRef(loadSettings());

  // Resolve initial setting values: prefer running-timer state, then settings, then defaults
  const initPomoMode: PomodoroMode = saved.current?.pomoMode ?? savedSettings.current?.pomoMode ?? "standard";
  const initStandardWork = sanitizeTimerMinutes(saved.current?.standardWork ?? savedSettings.current?.standardWork ?? 25);
  const initCustomWork = sanitizeTimerMinutes(saved.current?.customWork ?? savedSettings.current?.customWork ?? 25);
  const initCustomBreak = sanitizeTimerMinutes(saved.current?.customBreak ?? savedSettings.current?.customBreak ?? 5);

  const [pomoMode, setPomoMode] = useState<PomodoroMode>(initPomoMode);
  const [standardWork, setStandardWork] = useState(initStandardWork);
  const [customWork, setCustomWork] = useState(initCustomWork);
  const [customBreak, setCustomBreak] = useState(initCustomBreak);

  const workMin = sanitizeTimerMinutes(pomoMode === "standard" ? standardWork : customWork);
  const breakMin = sanitizeTimerMinutes(pomoMode === "standard" ? getStandardBreak(standardWork) : customBreak);

  const [mode, setMode] = useState<TimerMode>(saved.current?.mode ?? "work");
  const [consecutiveWork, setConsecutiveWork] = useState(saved.current?.consecutiveWork ?? 0);

  const initialRunning = !!saved.current && saved.current.endTime > Date.now() && saved.current.endTime - Date.now() <= MAX_TIMER_MS;
  const [endTime, setEndTime] = useState<number | null>(initialRunning ? saved.current!.endTime : null);
  const [seconds, setSeconds] = useState(() => {
    if (initialRunning) return Math.max(0, Math.ceil((saved.current!.endTime - Date.now()) / 1000));
    // Use the resolved initial work/break minutes (not derived state) to avoid stale 25-min default
    const initWorkMin = initPomoMode === "standard" ? initStandardWork : initCustomWork;
    const initBreakMin = initPomoMode === "standard" ? getStandardBreak(initStandardWork) : initCustomBreak;
    const initMode = saved.current?.mode ?? "work";
    return (initMode === "break" ? initBreakMin : initWorkMin) * 60;
  });

  const [sessionsToday, setSessionsToday] = useState(0);
  const [studiedTodayMin, setStudiedTodayMin] = useState(0);

  // Track minutes already saved for the current work session, so we never double-count
  const savedMinutesRef = useRef(0);
  const swRunningRef = useRef(false);
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

  // Persist runtime timer state (only when running — cleared when paused/stopped)
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

  // Always persist settings so the chosen preset survives page refresh even when the timer is paused
  useEffect(() => {
    saveSettings({ pomoMode, standardWork, customWork, customBreak });
  }, [pomoMode, standardWork, customWork, customBreak]);

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
      .then(() => {
        dispatchStudyUpdate();
      });
  }, [user, endTime, mode]);

  const dispatchStudyUpdate = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("zenith:study-update"));
    }
  }, []);

  const saveSession = useCallback(async (minutes: number, isCompletion = false) => {
    if (!user) return;
    // Sanitize: whole minutes, and cap at 24h to prevent runaway/corrupted values
    const safeMinutes = sanitizeMinutes(minutes);
    if (safeMinutes <= 0) return;
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject: "Pomodoro",
      duration_minutes: safeMinutes,
      local_date: getLocalDateKey(),
      session_type: isCompletion ? pomoMode : `${pomoMode}_partial`,
      completed_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Failed to save session:", error);
      toast.error(`Session save failed: ${error.message}`, { position: "bottom-center" });
    } else {
      if (isCompletion) {
        setSessionsToday((c) => c + 1);
        setStudiedTodayMin((c) => c + safeMinutes);
        toast.success(`Session complete! ${safeMinutes} min recorded.`, { position: "bottom-center" });
      } else {
        setStudiedTodayMin((c) => c + safeMinutes);
        toast(`⏱️ +${safeMinutes} min study progress saved!`, { position: "bottom-center" });
      }
      const active = (stateRef.current.mode === "work" && stateRef.current.endTime !== null) || swRunningRef.current;
      if (active) {
        supabase
          .from("profiles")
          .update({ is_studying: true, studying_since: new Date().toISOString() })
          .eq("user_id", user.id)
          .then(() => dispatchStudyUpdate());
      }
      dispatchStudyUpdate();
    }
  }, [user, pomoMode, dispatchStudyUpdate]);

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
          showSystemNotification(
            isLong ? "🎉 Long break time!" : "☕ Break time!",
            `Focus session complete. Take a ${nb}-minute break.`
          );
        } else {
          // Break finished — stop and wait for user to start next work session.
          // Do NOT auto-restart a new work cycle: that caused the timer to run
          // forever in background tabs and log false study minutes.
          setMode("work");
          setSeconds(workMin * 60);
          setEndTime(null);
          toast.success("💪 Break over — press start when ready.");
          showSystemNotification("💪 Break over!", "Press start when you're ready for the next focus session.");
        }
      } else {
        setSeconds(remaining);
        
        // Auto-save every completed minute during work mode
        if (mode === "work") {
          const elapsedSec = workMin * 60 - remaining;
          const totalMinutes = Math.floor(elapsedSec / 60);
          const delta = totalMinutes - savedMinutesRef.current;
          if (delta >= 1) {
            savedMinutesRef.current = totalMinutes;
            saveSession(delta);
          }
        }
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
    Promise.all([
      supabase
        .from("study_daily_totals")
        .select("total_minutes")
        .eq("user_id", user.id)
        .eq("study_date", getLocalDateKey())
        .maybeSingle(),
      supabase
        .from("study_sessions")
        .select("id, session_type")
        .eq("user_id", user.id)
        .gte("completed_at", today.toISOString()),
    ]).then(([totalRes, sessionRes]) => {
        const rows = sessionRes.data || [];
        const completed = rows.filter((s: any) => !String(s.session_type || "").endsWith("_partial"));
        setSessionsToday(completed.length);
        setStudiedTodayMin(sanitizeMinutes(Number(totalRes.data?.total_minutes ?? 0)));
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
    const totalMinutes = Math.floor(elapsedSec / 60);
    const delta = totalMinutes - savedMinutesRef.current;
    if (delta >= 1) {
      savedMinutesRef.current = totalMinutes;
      saveSession(delta);
    }
  };


  // On tab close / refresh: save remaining partial work time via keepalive fetch
  useEffect(() => {
    const flush = (isUnload = false) => {
      const { mode: m, endTime: et, workMin: wm, userId } = stateRef.current;
      const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let token = apikey;
      try {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
        if (keys[0]) {
          const parsed = JSON.parse(localStorage.getItem(keys[0]) || "{}");
          if (parsed?.access_token) token = parsed.access_token;
        }
      } catch {}

      if (isUnload) {
        // Clear running timer state so it doesn't resume on reopen
        localStorage.removeItem(TIMER_KEY);

        // Turn off studying flag in database immediately
        if (userId) {
          const urlProfile = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`;
          fetch(urlProfile, {
            method: "PATCH",
            keepalive: true,
            headers: {
              "Content-Type": "application/json",
              apikey,
              Authorization: `Bearer ${token}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              is_studying: false,
              studying_since: null,
            }),
          }).catch(() => {});
        }
      }

      if (!userId || m !== "work" || et === null) return;
      const remaining = Math.max(0, Math.ceil((et - Date.now()) / 1000));
      const elapsedSec = wm * 60 - remaining;
      const totalMinutes = sanitizeMinutes(elapsedSec / 60);
      const delta = totalMinutes - savedMinutesRef.current;
      if (delta < 1) return;
      const safeDelta = sanitizeMinutes(delta);
      if (safeDelta < 1) return;
      savedMinutesRef.current = Math.min(MAX_DAILY_MINUTES, savedMinutesRef.current + safeDelta);
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/study_sessions`;
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
            duration_minutes: safeDelta,
            local_date: getLocalDateKey(),
            session_type: `${pomoMode}_partial`,
            completed_at: new Date().toISOString(),
          }),
        }).catch(() => {});
      } catch {}
    };

    const onHide = () => flush(true);
    const onVis = () => { if (document.visibilityState === "hidden") flush(false); };
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
    setEndTime(Date.now() + Math.min(seconds, MAX_DAILY_MINUTES * 60) * 1000);
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

  const addStudyTime = async (minutes: number, asCompletedSession = true) => {
    const m = sanitizeMinutes(minutes);
    if (m <= 0) return;
    await saveSession(m, asCompletedSession);
  };

  // ============ Stopwatch (persistent count-up) ============
  type SwPersist = { startedAt: number | null; baseSec: number };
  const swSaved = useRef<SwPersist>((() => {
    try {
      const s = JSON.parse(localStorage.getItem(SW_KEY) || "") as SwPersist;
      // Guard: if startedAt is stale (older than 24h), don't auto-resume — treat as abandoned
      if (s?.startedAt && Date.now() - s.startedAt > MAX_TIMER_MS) {
        return { startedAt: null, baseSec: 0 };
      }
      return s;
    } catch { return { startedAt: null, baseSec: 0 }; }
  })());
  const [swStartedAt, setSwStartedAt] = useState<number | null>(swSaved.current.startedAt);
  const [swBaseSec, setSwBaseSec] = useState<number>(swSaved.current.baseSec || 0);
  const [swSeconds, setSwSeconds] = useState<number>(() => {
    const s = swSaved.current;
    return (s.baseSec || 0) + (s.startedAt ? Math.floor((Date.now() - s.startedAt) / 1000) : 0);
  });
  const swRunning = swStartedAt !== null;
  const swSavedMinRef = useRef(0);
  swRunningRef.current = swRunning;

  useEffect(() => {
    if (!user) return;
    const studying = swRunning;
    supabase
      .from("profiles")
      .update({ is_studying: studying, studying_since: studying ? new Date().toISOString() : null })
      .eq("user_id", user.id)
      .then(() => dispatchStudyUpdate());
  }, [user, swRunning, dispatchStudyUpdate]);

  useEffect(() => {
    localStorage.setItem(SW_KEY, JSON.stringify({ startedAt: swStartedAt, baseSec: swBaseSec }));
  }, [swStartedAt, swBaseSec]);

  // Tick: update displayed seconds + auto-save every minute
  useEffect(() => {
    if (!swRunning) return;
    const id = window.setInterval(() => {
      const total = swBaseSec + Math.floor((Date.now() - (swStartedAt as number)) / 1000);
      setSwSeconds(total);
      const totalMin = Math.floor(total / 60);
      const delta = totalMin - swSavedMinRef.current;
      if (delta >= 1) {
        swSavedMinRef.current = totalMin;
        saveSession(delta, false);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [swRunning, swStartedAt, swBaseSec, saveSession]);

  const startStopwatch = () => {
    if (endTime !== null) {
      // Single active-session lock: pause pomodoro first
      savePartialIfWork();
      setEndTime(null);
    }
    if (swStartedAt !== null) return;
    setSwStartedAt(Date.now());
  };

  const pauseStopwatch = () => {
    if (swStartedAt === null) return;
    const total = swBaseSec + Math.floor((Date.now() - swStartedAt) / 1000);
    setSwBaseSec(total);
    setSwStartedAt(null);
    setSwSeconds(total);
    const totalMin = Math.floor(total / 60);
    const delta = totalMin - swSavedMinRef.current;
    if (delta >= 1) { swSavedMinRef.current = totalMin; saveSession(delta, false); }
  };

  const stopStopwatch = async () => {
    const total = swStartedAt !== null
      ? swBaseSec + Math.floor((Date.now() - swStartedAt) / 1000)
      : swBaseSec;
    setSwStartedAt(null);
    setSwBaseSec(0);
    setSwSeconds(0);
    const totalMin = Math.floor(total / 60);
    const delta = totalMin - swSavedMinRef.current;
    if (delta >= 1) await saveSession(delta, false);
    swSavedMinRef.current = 0;
    if (totalMin >= 1) toast.success(`Stopwatch saved · ${totalMin} min added`);
  };

  // Lock: starting pomodoro should stop the stopwatch
  const startLocked = () => {
    if (swStartedAt !== null) {
      const total = swBaseSec + Math.floor((Date.now() - swStartedAt) / 1000);
      setSwBaseSec(total);
      setSwStartedAt(null);
      setSwSeconds(total);
      const totalMin = Math.floor(total / 60);
      const delta = totalMin - swSavedMinRef.current;
      if (delta >= 1) { swSavedMinRef.current = totalMin; saveSession(delta, false); }
    }
    start();
  };

  const toggleLocked = () => (running ? pause() : startLocked());

  return (
    <Ctx.Provider value={{
      pomoMode, setPomoMode,
      standardWork, setStandardWork: (n) => setStandardWork(sanitizeTimerMinutes(n)),
      customWork, setCustomWork: (n) => setCustomWork(sanitizeTimerMinutes(n)),
      customBreak, setCustomBreak: (n) => setCustomBreak(sanitizeTimerMinutes(n)),
      workMin, breakMin, mode, seconds, running, consecutiveWork,
      sessionsToday, studiedTodayMin,
      start: startLocked, pause, toggle: toggleLocked, reset, skip, addStudyTime,
      swSeconds, swRunning, startStopwatch, pauseStopwatch, stopStopwatch,
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
