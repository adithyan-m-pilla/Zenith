import { CheckCircle2, Circle, BookOpen, PenTool, CalendarClock } from "lucide-react";
import { useState } from "react";
import { getRevisionLabel } from "@/lib/revision";

interface Task {
  id: string;
  title: string;
  subject: string;
  type: "revise" | "practice";
  completed: boolean;
  revisionNumber?: number;
}

const initialTasks: Task[] = [
  { id: "1", title: "Revise: Laws of Motion", subject: "Physics", type: "revise", completed: false, revisionNumber: 2 },
  { id: "2", title: "Practice: Integration by Parts", subject: "Mathematics", type: "practice", completed: true },
  { id: "3", title: "Revise: Work, Energy & Power", subject: "Physics", type: "revise", completed: false, revisionNumber: 1 },
  { id: "4", title: "Revise: Atomic Structure", subject: "Chemistry", type: "revise", completed: false, revisionNumber: 3 },
  { id: "5", title: "Practice: Cell Biology MCQs", subject: "Biology", type: "practice", completed: false },
];

const TodayTasks = () => {
  const [tasks, setTasks] = useState(initialTasks);

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const completed = tasks.filter((t) => t.completed).length;

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground">Today's Tasks</h3>
        <span className="text-xs text-muted-foreground">{completed}/{tasks.length} done</span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => toggleTask(task.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
              task.completed ? "bg-muted/50" : "bg-secondary/50 hover:bg-secondary"
            }`}
          >
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {task.title}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{task.subject}</p>
                {task.revisionNumber !== undefined && (
                  <span className="text-[10px] text-info flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />
                    {getRevisionLabel(task.revisionNumber).replace(/\(.*\)/, "").trim()}
                  </span>
                )}
              </div>
            </div>
            {task.type === "revise" ? (
              <BookOpen className="w-4 h-4 text-info shrink-0" />
            ) : (
              <PenTool className="w-4 h-4 text-warning shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TodayTasks;
