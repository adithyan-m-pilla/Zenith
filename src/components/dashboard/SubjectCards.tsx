import { BookOpen, CheckCircle, Clock } from "lucide-react";

const subjects = [
  { name: "Physics", total: 15, completed: 8, color: "from-blue-500/20 to-blue-600/5" },
  { name: "Chemistry", total: 16, completed: 5, color: "from-emerald-500/20 to-emerald-600/5" },
  { name: "Mathematics", total: 13, completed: 10, color: "from-amber-500/20 to-amber-600/5" },
  { name: "Biology", total: 18, completed: 12, color: "from-rose-500/20 to-rose-600/5" },
];

const SubjectCards = () => {
  return (
    <div className="animate-fade-in">
      <h3 className="font-heading font-semibold text-foreground mb-3">Subjects</h3>
      <div className="grid grid-cols-2 gap-3">
        {subjects.map((sub) => {
          const percent = Math.round((sub.completed / sub.total) * 100);
          return (
            <div key={sub.name} className={`glass-card p-4 bg-gradient-to-br ${sub.color}`}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-primary" />
                <h4 className="font-heading text-sm font-semibold text-foreground">{sub.name}</h4>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-primary" />
                  <span>{sub.completed} completed</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{sub.total - sub.completed} pending</span>
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
