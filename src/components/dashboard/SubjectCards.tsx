import { BookOpen, CheckCircle, Clock } from "lucide-react";
import { useSyllabus } from "@/hooks/useSyllabus";

const colors = [
  "from-blue-500/20 to-blue-600/5",
  "from-emerald-500/20 to-emerald-600/5",
  "from-amber-500/20 to-amber-600/5",
  "from-rose-500/20 to-rose-600/5",
  "from-violet-500/20 to-violet-600/5",
  "from-cyan-500/20 to-cyan-600/5",
];

const SubjectCards = () => {
  const { subjects } = useSyllabus();

  if (subjects.length === 0) return null;

  return (
    <div className="animate-fade-in">
      <h3 className="font-heading font-semibold text-foreground mb-3">Subjects</h3>
      <div className="grid grid-cols-2 gap-3">
        {subjects.map((sub, i) => {
          const completed = sub.chapters.filter((c) => c.is_completed).length;
          const total = sub.chapters.length;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
          return (
            <div key={sub.id} className={`glass-card p-4 bg-gradient-to-br ${colors[i % colors.length]}`}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-primary" />
                <h4 className="font-heading text-sm font-semibold text-foreground">{sub.name}</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-primary" />
                  <span>{completed} completed</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{total - completed} pending</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SubjectCards;
