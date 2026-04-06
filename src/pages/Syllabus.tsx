import { useState } from "react";
import { Plus, BookOpen, Check, ChevronDown, ChevronRight, CalendarClock, Trash2 } from "lucide-react";
import { REVISION_INTERVALS, getRevisionDueDate, getRevisionLabel } from "@/lib/revision";
import { useSyllabus } from "@/hooks/useSyllabus";

const Syllabus = () => {
  const {
    subjects, loading, addSubject, deleteSubject, addChapter, deleteChapter, toggleChapter,
  } = useSyllabus();

  const [newSubject, setNewSubject] = useState("");
  const [addingChapter, setAddingChapter] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const handleAddSubject = async () => {
    await addSubject(newSubject);
    setNewSubject("");
  };

  const handleAddChapter = async (subjectId: string) => {
    await addChapter(subjectId, newChapter);
    setNewChapter("");
    setAddingChapter(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" /> Syllabus
        </h1>
        <p className="text-muted-foreground mt-1">Spaced revision: Day 1 → 3 → 5 → 7 → 15 → 30 → 90</p>
      </div>

      <div className="glass-card p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Revision Schedule</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {REVISION_INTERVALS.map((day, i) => (
            <span key={i} className="text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
              {getRevisionLabel(i).replace(/\(.*\)/, "")}— Day {day}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 animate-fade-in">
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
          placeholder="Add new subject..."
          className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={handleAddSubject} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="space-y-3 animate-fade-in">
        {subjects.map((subject) => {
          const completed = subject.chapters.filter((c) => c.is_completed).length;
          const isExpanded = expanded[subject.id] ?? false;
          return (
            <div key={subject.id} className="glass-card overflow-hidden">
              <div className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors">
                <button onClick={() => toggleExpand(subject.id)} className="flex items-center gap-3 flex-1 text-left">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <h3 className="font-heading font-semibold text-foreground flex-1">{subject.name}</h3>
                  <span className="text-xs text-muted-foreground">{completed}/{subject.chapters.length} chapters</span>
                </button>
                <button onClick={() => deleteSubject(subject.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-border px-4 pb-4">
                  <div className="space-y-1 mt-2">
                    {subject.chapters.map((ch) => {
                      const revInfo = ch.is_completed && ch.completed_date
                        ? ch.revisions_completed >= REVISION_INTERVALS.length
                          ? { label: "All reviews done ✓", date: "" }
                          : { label: getRevisionLabel(ch.revisions_completed), date: getRevisionDueDate(ch.completed_date, ch.revisions_completed) }
                        : null;
                      return (
                        <div key={ch.id}>
                          <div className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${ch.is_completed ? "bg-accent/30" : "hover:bg-secondary/50"}`}>
                            <button onClick={() => toggleChapter(ch)} className="flex items-center gap-3 flex-1 text-left">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${ch.is_completed ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                                {ch.is_completed && <Check className="w-3 h-3 text-primary-foreground" />}
                              </div>
                              <span className={`text-sm flex-1 ${ch.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {ch.name}
                              </span>
                              {ch.completed_date && <span className="text-[10px] text-muted-foreground">✓ {ch.completed_date}</span>}
                            </button>
                            <button onClick={() => deleteChapter(ch.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          {revInfo && (
                            <div className="ml-10 mt-0.5 mb-1 flex items-center gap-1.5">
                              <CalendarClock className="w-3 h-3 text-info" />
                              <span className="text-[10px] text-info">
                                Next: {revInfo.label} {revInfo.date && `(${revInfo.date})`}
                              </span>
                              {ch.revisions_completed > 0 && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  ({ch.revisions_completed}/{REVISION_INTERVALS.length} done)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {addingChapter === subject.id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={newChapter}
                        onChange={(e) => setNewChapter(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddChapter(subject.id)}
                        placeholder="Chapter name..."
                        autoFocus
                        className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button onClick={() => handleAddChapter(subject.id)} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">Add</button>
                      <button onClick={() => { setAddingChapter(null); setNewChapter(""); }} className="text-muted-foreground px-3 py-2 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingChapter(subject.id)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mt-2 p-2 transition-colors">
                      <Plus className="w-3 h-3" /> Add chapter
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {subjects.length === 0 && (
          <div className="glass-card p-8 text-center text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No subjects yet. Add your first subject above!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Syllabus;
