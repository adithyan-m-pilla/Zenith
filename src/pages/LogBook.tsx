import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, BookOpen, Plus, Check, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSyllabus } from "@/hooks/useSyllabus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fmtHM = (min: number) => {
  const m = Math.max(0, Math.floor(min));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const LogBook = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { subjects, refetch: refetchSyllabus } = useSyllabus();

  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [joinDate, setJoinDate] = useState<Date | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [minutesInput, setMinutesInput] = useState("");
  const [chapterQuery, setChapterQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const monthLabel = cursor.toLocaleString("default", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("created_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.created_at) {
          const d = new Date(data.created_at);
          setJoinDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        }
      });
  }, [user]);

  const loadTotals = useCallback(async () => {
    if (!user) return;
    const start = dateKey(new Date(year, month, 1));
    const end = dateKey(new Date(year, month, daysInMonth));
    const { data } = await supabase
      .from("study_daily_totals")
      .select("study_date, total_minutes")
      .eq("user_id", user.id)
      .gte("study_date", start)
      .lte("study_date", end);
    const map: Record<string, number> = {};
    (data || []).forEach((r) => {
      map[r.study_date] = Math.max(0, Math.floor(r.total_minutes || 0));
    });
    setTotals(map);
  }, [user, year, month, daysInMonth]);

  useEffect(() => {
    loadTotals();
  }, [loadTotals]);

  const allChapters = useMemo(
    () => subjects.flatMap((s) => s.chapters.map((c) => ({ ...c, subjectName: s.name }))),
    [subjects]
  );

  const monthMinutes = useMemo(
    () => Object.values(totals).reduce((a, b) => a + b, 0),
    [totals]
  );

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthChapters = useMemo(
    () => allChapters.filter((c) => c.is_completed && c.completed_date?.startsWith(monthPrefix)),
    [allChapters, monthPrefix]
  );

  const activeDays = Object.values(totals).filter((m) => m > 0).length;

  const isBeforeJoin = (key: string) => (joinDate ? key < dateKey(joinDate) : false);
  const isFuture = (key: string) => key > dateKey(today);

  const heat = (min: number) => {
    if (!min) return "bg-heatmap-0";
    if (min >= 300) return "bg-heatmap-3";
    if (min >= 180) return "bg-heatmap-2";
    return "bg-heatmap-1";
  };

  const selectedChaptersDone = selected
    ? allChapters.filter((c) => c.is_completed && c.completed_date === selected)
    : [];
  const q = chapterQuery.trim().toLowerCase();
  const pendingChapters = allChapters.filter(
    (c) =>
      !c.is_completed &&
      (!q || c.name.toLowerCase().includes(q) || c.subjectName.toLowerCase().includes(q))
  );

  const addTime = async () => {
    if (!user || !selected) return;
    const mins = Math.floor(Number(minutesInput));
    if (!mins || mins <= 0 || mins > 1440) {
      toast({ title: "Enter minutes between 1 and 1440", variant: "destructive" });
      return;
    }
    setSaving(true);
    const completedAt = new Date(`${selected}T12:00:00`);
    const { error } = await supabase.from("study_sessions").insert({
      user_id: user.id,
      subject: "Log Book entry",
      session_type: "manual",
      duration_minutes: mins,
      completed_at: completedAt.toISOString(),
      local_date: selected,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setMinutesInput("");
    toast({ title: `Added ${fmtHM(mins)} to ${selected}` });
    loadTotals();
  };

  const markChapter = async (chapterId: string) => {
    if (!selected) return;
    const { error } = await supabase
      .from("chapters")
      .update({ is_completed: true, completed_date: selected, revisions_completed: 0, last_revision_date: null })
      .eq("id", chapterId);
    if (error) {
      toast({ title: "Could not update chapter", description: error.message, variant: "destructive" });
      return;
    }
    await refetchSyllabus();
    toast({ title: "Chapter marked finished", description: `Revision cycle starts from ${selected}` });
  };

  const unmarkChapter = async (chapterId: string) => {
    const { error } = await supabase
      .from("chapters")
      .update({ is_completed: false, completed_date: null, revisions_completed: 0, last_revision_date: null })
      .eq("id", chapterId);
    if (error) {
      toast({ title: "Could not update chapter", description: error.message, variant: "destructive" });
      return;
    }
    await refetchSyllabus();
    toast({ title: "Chapter unmarked" });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <CalendarDays className="w-6 h-6 text-primary" />
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Log Book</h1>
          <p className="text-sm text-muted-foreground">
            Every day since you joined — backfill study time and finished chapters.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Hours this month</p>
          <p className="font-heading text-2xl font-bold text-foreground">{fmtHM(monthMinutes)}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Chapters finished</p>
          <p className="font-heading text-2xl font-bold text-foreground">{monthChapters.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Active days</p>
          <p className="font-heading text-2xl font-bold text-foreground">{activeDays}</p>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            disabled={!!joinDate && new Date(year, month, 1) <= new Date(joinDate.getFullYear(), joinDate.getMonth(), 1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-heading font-semibold text-foreground">{monthLabel}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            disabled={year === today.getFullYear() && month === today.getMonth()}
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-[10px] text-muted-foreground text-center font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`e-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const key = dateKey(new Date(year, month, day));
            const mins = totals[key] || 0;
            const disabled = isFuture(key) || isBeforeJoin(key);
            const chaps = allChapters.filter((c) => c.is_completed && c.completed_date === key).length;
            return (
              <button
                key={day}
                disabled={disabled}
                onClick={() => { setSelected(key); setMinutesInput(""); }}
                className={`aspect-square rounded-md relative ${heat(mins)} ${
                  disabled ? "opacity-30 cursor-not-allowed" : "hover:ring-2 hover:ring-primary/60"
                } transition-all`}
                title={`${key} — ${fmtHM(mins)}`}
              >
                <span className="absolute top-1 left-1.5 text-[10px] text-foreground/70">{day}</span>
                {mins > 0 && (
                  <span className="absolute bottom-1 left-0 right-0 text-[9px] text-foreground/80">{fmtHM(mins)}</span>
                )}
                {chaps > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {monthChapters.length > 0 && (
        <div className="glass-card p-4 sm:p-5">
          <h3 className="font-heading font-semibold text-foreground mb-3 text-sm">
            Chapters finished in {monthLabel}
          </h3>
          <div className="space-y-2">
            {monthChapters.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{c.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.subjectName} · {c.completed_date}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => unmarkChapter(c.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{selected}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Studied {fmtHM(totals[selected || ""] || 0)}
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  placeholder="Minutes to add"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(e.target.value)}
                />
                <Button onClick={addTime} disabled={saving}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Chapters finished this day
              </p>
              {selectedChaptersDone.length === 0 ? (
                <p className="text-xs text-muted-foreground">None yet</p>
              ) : (
                <div className="space-y-1 mb-3">
                  {selectedChaptersDone.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <Check className="w-3.5 h-3.5 text-primary" /> {c.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        onClick={() => unmarkChapter(c.id)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Untick
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative mt-3 mb-2">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 text-sm"
                  placeholder="Search chapters or subjects"
                  value={chapterQuery}
                  onChange={(e) => setChapterQuery(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mb-1">
                Marking a chapter here starts its revision cycle from {selected}.
              </p>

              {pendingChapters.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching pending chapters</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
                  {pendingChapters.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => markChapter(c.id)}
                      className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.subjectName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogBook;
