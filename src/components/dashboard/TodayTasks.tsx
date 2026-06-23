import { BookOpen, CalendarClock, Check } from "lucide-react";
import { useSyllabus, Chapter } from "@/hooks/useSyllabus";
import { getDueRevisions, getRevisionLabel } from "@/lib/revision";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const TodayTasks = () => {
  const { subjects, markRevisionDone } = useSyllabus();
  const today = new Date().toISOString().split("T")[0];
  const [busy, setBusy] = useState<string | null>(null);

  const tasks = useMemo(() => {
    const result: {
      chapter: Chapter;
      title: string;
      subject: string;
      revisionLabel: string;
    }[] = [];
    for (const sub of subjects) {
      for (const ch of sub.chapters) {
        if (ch.is_completed && ch.completed_date) {
          const dueIdx = getDueRevisions(
            ch.completed_date,
            ch.revisions_completed,
            today,
            ch.last_revision_date
          );
          if (dueIdx !== null) {
            result.push({
              chapter: ch,
              title: `Revise: ${ch.name}`,
              subject: sub.name,
              revisionLabel: getRevisionLabel(dueIdx).replace(/\(.*\)/, "").trim(),
            });
          }
        }
      }
    }
    return result;
  }, [subjects, today]);

  const handleTick = async (ch: Chapter) => {
    if (busy) return;
    setBusy(ch.id);
    await markRevisionDone(ch);
    toast.success("Revision marked done — next one scheduled");
    setBusy(null);
  };

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground">Today's Revisions</h3>
        <span className="text-xs text-muted-foreground">{tasks.length} due</span>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No revisions due today 🎉</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const isBusy = busy === task.chapter.id;
            return (
              <div
                key={task.chapter.id}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-all text-left"
              >
                <button
                  onClick={() => handleTick(task.chapter)}
                  disabled={isBusy}
                  aria-label="Mark revision done"
                  className="w-5 h-5 rounded border-2 border-primary/60 hover:border-primary flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                >
                  {isBusy && <Check className="w-3 h-3 text-primary animate-pulse" />}
                </button>
                <BookOpen className="w-5 h-5 text-info shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">{task.subject}</p>
                    <span className="text-[10px] text-info flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      {task.revisionLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        Tick the box when you finish a revision — the next one will be scheduled from today.
      </p>
    </div>
  );
};

export default TodayTasks;
