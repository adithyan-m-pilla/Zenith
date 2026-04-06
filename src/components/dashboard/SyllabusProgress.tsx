import { useSyllabus } from "@/hooks/useSyllabus";

const SyllabusProgress = () => {
  const { totalChapters, completedChapters } = useSyllabus();
  const percent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;

  return (
    <div className="glass-card p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-sm font-semibold text-foreground">Syllabus Completion</h3>
        <span className="text-xs font-medium text-primary">{percent}%</span>
      </div>
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {totalChapters > 0
          ? `${completedChapters} of ${totalChapters} chapters completed`
          : "Add subjects in Syllabus to track progress"}
      </p>
    </div>
  );
};

export default SyllabusProgress;
